import './createPost.js';
import { Devvit, useState } from '@devvit/public-api';
import GeminiFetcher from './gemini.js';

// Defines the messages that are exchanged between Devvit and Web View
type WebViewMessage = 
  | { type: 'setScore'; data: { newScore: number } }
  | { type: 'updateScore'; data: { score: number } }
  | { type: 'initialData'; data: { username: string; currentScore: number; currentLevel: number; gameCompleted: boolean } }
  | { type: 'fetchComment'; data: { moodTone: string } }
  | { type: 'fetchedComment'; data: { comment: string; summary: string } }
  | { type: 'userDescription'; data: { description: string } }
  | { type: 'shareComment'; data: { summary: string } }
  | { type: 'fetchTopScoreComment'; data: { comment: string } }
  | { type: 'fetchRandomComment'; data: { comment: string } };

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Webview Example',
  height: 'tall',
  render: (context) => {
    // Load username with `useAsync` hook
    const [username] = useState(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return currUser?.username ?? 'anon';
    });

    // Load latest score from Redis with `useAsync` hook
    const [score, setScore] = useState(async () => {
      const redisScore = await context.redis.get(`score_${username}`);
      return Number(redisScore ?? 0);
    });

    // Load best score from Redis with `useAsync` hook
    const [myBestScore, setMyBestScore] = useState(async () => {
      const redisBestScore = await context.redis.get(`bestScore_${username}`);
      return Number(redisBestScore ?? 0);
    });

    const [leaderboardVisible, setLeaderboardVisible] = useState(false);
    const [leaderboardData, setLeaderboardData] = useState<string[]>([]);

    const updateLeaderboard = async (bestScore: number) => {
      const key = 'leaderboard';
      console.log('Updating leaderboard...');
      if (username) {
        console.log(`Updating leaderboard: Adding ${username} with score ${bestScore}`);
        await context.redis.zAdd(key, { member: username, score: bestScore });
      } else {
        console.log('Username is missing; cannot update leaderboard.');
      }
    };
    
    const fetchLeaderboard = async () => {
      const key = 'leaderboard';
      try {
        console.log('Fetching leaderboard data...');
        const data = await context.redis.zRange(key, 0, -1);
        if (data.length === 0) {
          console.warn('Leaderboard is empty.');
        } else {
          console.log('Leaderboard data fetched:', data);
        }
        setLeaderboardData(data.map(({ member, score }) => `${member}: ${score}`));
        setLeaderboardVisible(true);
      } catch (error) {
        console.error('Error fetching leaderboard data:', error);
      }
    };

    const fetchRandomComment = async (): Promise<{ comment: string }[]> => {
      try {
        const comments = await context.reddit.getComments({
          postId: 't3_1he8bqk', // Replace with your actual post ID
          sort: 'random', // Sort randomly to get random comments
          limit: 1, // Fetch only one random comment
        }).all();

        if (comments.length > 0) {
          const randomComment = comments[0];
          return [
            {
              comment: randomComment.body ?? 'No text available',
            },
          ];
        } else {
          return [{ comment: 'No comments found.' }];
        }
      } catch (error) {
        return error instanceof Error
          ? [{ comment: `Error: ${error.message}` }]
          : [{ comment: 'Unknown error occurred.' }];
      }
    };

    // Function to fetch the latest comments from the user
    const fetchLastComments = async (username: string): Promise<string[]> => {
      try {
        const latestComments = context.reddit.getCommentsByUser({ username, sort: 'new', limit: 10 });
        const commentArray = await latestComments.get(10);
        return commentArray.length > 0
          ? commentArray.map((comment) => comment.body ?? 'No text available')
          : ['No comments found.'];
      } catch (error) {
        return error instanceof Error ? [`Error: ${error.message}`] : ['Unknown error occurred.'];
      }
    };

    // Function to fetch the top score comment
    const fetchTopScoreComment = async (): Promise<{ comment: string; author: string }[]> => {
      try {
        const comments = await context.reddit.getComments({
          postId: 't3_1he8bqk', // Replace with your actual post ID
          sort: 'top',
          limit: 1, // Fetch only the top comment
        }).all();
    
        if (comments.length > 0) {
          const topComment = comments[0];
          return [
            {
              comment: topComment.body ?? 'No text available',
              author: topComment.authorName ?? 'Anonymous',
            },
          ];
        } else {
          return [{ comment: 'No comments found.', author: 'None' }];
        }
      } catch (error) {
        return error instanceof Error
          ? [{ comment: `Error: ${error.message}`, author: 'Error' }]
          : [{ comment: 'Unknown error occurred.', author: 'Error' }];
      }
    };

    // Function to generate a summary based on the comment and mood tone
    const generateSummary = async (comment: string, moodTone: string): Promise<string> => {
      const prompt = `Reply straightforward without unnecessary intro or details, a Haiku with ${moodTone} tone: "${comment}"`;
      return await GeminiFetcher(prompt) ?? 'Summary not available.';
    };

    // Function to generate user description based on their comments
    const generateUserDescription = async (comments: string[]): Promise<string> => {
      const redditPersonas = [
        "Meme Maker", "Knowledge Seeker", "Commentator", "Supportive User", "Casual Lurker", "Troll", "Content Curator", "Debate Enthusiast", "Hobbyist", "Critic", "Newbie", "Builder"
      ];
      const describeUserPrompt = `Based on the following 10 comments, describe this user as a person by selecting the single persona that best represents the user. Choose from the following list, and only return the word of the persona with nothing else, strictly:\n\n${redditPersonas.join(', ')}\n\nHere are the comments:\n\n${comments.join('\n\n')}`;
      return await GeminiFetcher(describeUserPrompt) ?? 'Description not available.';
    };
    

    // Create a reactive state for web view visibility
    const [webviewVisible, setWebviewVisible] = useState(false);

    const isMessageOfType = <T extends WebViewMessage['type']>(msg: WebViewMessage, type: T): msg is Extract<WebViewMessage, { type: T }> => msg.type === type;

    // When the web view invokes `window.parent.postMessage` this function is called
    const onMessage = async (msg: WebViewMessage) => {
      if (isMessageOfType(msg, 'fetchComment')) {
        if (username) {
          const comments = await fetchLastComments(username);
          const latestComment = comments[0];
          const summary = await generateSummary(latestComment, msg.data.moodTone);
          context.ui.webView.postMessage('myWebView', {
            type: 'fetchedComment',
            data: { comment: latestComment, summary },
          });
        }
      } else if (isMessageOfType(msg, 'userDescription')) {
        if (username) {
          const comments = await fetchLastComments(username);
          const description = await generateUserDescription(comments);
          context.ui.webView.postMessage('myWebView', {
            type: 'userDescription',
            data: { description },
          });
        }
      } else if (isMessageOfType(msg, 'fetchRandomComment')) {
        if (username) {
          const randomComment = await fetchRandomComment();
          context.ui.webView.postMessage('myWebView', {
            type: 'fetchRandomComment',
            data: { comment: randomComment[0].comment },
          });
        }
      } else if (isMessageOfType(msg, 'fetchTopScoreComment')) {
        const topScoreComment = await fetchTopScoreComment();
        context.ui.webView.postMessage('myWebView', {
          type: 'fetchTopScoreComment',
          data: { comment: topScoreComment[0].comment, author: topScoreComment[0].author },
        });
      } else if (isMessageOfType(msg, 'shareComment')) {
        if (msg.data.summary) {
          const richText = msg.data.summary;
          await context.reddit.submitComment({
            id: context.postId ?? '',
            text: richText,
          });
        } else {
          console.error('No summary provided for sharing.');
        }
      } else if (isMessageOfType(msg, 'setScore')) {
        const newScore = msg.data.newScore;
        await context.redis.set(`score_${username}`, newScore.toString());
        setScore(newScore);
      } else if (isMessageOfType(msg, 'updateScore')) {
        const newScore = msg.data.score;
        await context.redis.set(`score_${username}`, newScore.toString());
        setScore(newScore);
      } else if (isMessageOfType(msg, 'initialData')) {
        const { currentScore, currentLevel, gameCompleted } = msg.data;
        await context.redis.set(`score_${username}`, currentScore.toString());
        await context.redis.set(`level_${username}`, currentLevel.toString());
        await context.redis.set(`gameCompleted_${username}`, gameCompleted.toString());
        setScore(currentScore);
      } else {
        throw new Error(`Unhandled message type: ${msg}`);
      }
    };

    // When the button is clicked, send initial data to web view and show it
    const onShowWebviewClick = () => {
      setWebviewVisible(true);
      context.ui.webView.postMessage('myWebView', {
        type: 'initialData',
        data: {
          username: username,
          currentScore: score,
        },
      });
    };
    
    // Function to reset score and level
    const onResetGameClick = async () => {
      //const resetScore = 0;
      const resetGameCompleted = false;

      // Update score and level in redis
      //await context.redis.set(`score_${username}`, resetScore.toString());
      await context.redis.set(`gameCompleted_${username}`, resetGameCompleted.toString());

      // Update best score if the current score is greater
      if (score > myBestScore) {
        await context.redis.set(`bestScore_${username}`, score.toString());
        setMyBestScore(score);
        updateLeaderboard(score);
      }

      // Send reset data to web view
      context.ui.webView.postMessage('myWebView', {
        type: 'initialData',
        data: {
          username: username,
          currentScore: score,
        },
      });
    };

    // Render the custom post type
    return (
      <vstack grow padding="small" >
        <vstack
          grow={!webviewVisible}
          height={webviewVisible ? '0%' : '100%'}
          alignment="middle center">
          <spacer />
          <zstack width="100%" height="100%" alignment="center middle">
            <image url="home.png" imageHeight="256px" imageWidth="256px" width="100%" height="100%"  resizeMode='cover'/>
            <vstack alignment="center middle">
               <vstack alignment="center middle" backgroundColor="white" cornerRadius='medium' padding='medium'>
                  <hstack>
                    <text size="xlarge" color='black'>Hello, </text>
                    <spacer />
                    <text size="xlarge" color='AlienBlue-600' weight="bold">
                      {' '}{username ?? ''}
                    </text>
                  </hstack>
                  <spacer />
                  <hstack>
                  <hstack>
                    <text size="large" color='black'>🪙 Current score:</text>
                    <spacer />
                    <text size="large" color='AlienBlue-600' weight="bold">
                      {' '}{score ?? ''}
                    </text>
                  </hstack>
                  <spacer />
                  <hstack>
                    <text size="large" color='black'>💎 My Best score:</text>
                    <spacer />
                    <text size="large" color='AlienBlue-600' weight="bold">
                      {' '}{myBestScore ?? ''}
                    </text>
                  </hstack>
                  </hstack>
                  <spacer />
                  <hstack>
                  </hstack>
                </vstack>
                <spacer size='medium'/>
                {/* Add the reset button */} 
                <hstack>
                <button onPress={onResetGameClick}>
                🔄 Update Score</button>
                <spacer />
                <button 
                  onPress={onShowWebviewClick}
                >
                 ▶ Play
                </button>
                <spacer />
                <button onPress={fetchLeaderboard}>🏆 Leaderboard</button>
                <spacer />
              
                {leaderboardVisible && ( // Render the Close button only if leaderboardVisible is true
                  <button onPress={() => setLeaderboardVisible(false)}>❌</button>
                )}
              
                </hstack> 

                            {/* Leaderboard Popup */}
                            <spacer size='medium' />
                {leaderboardVisible && (
                  <vstack
                    backgroundColor="white"
                    cornerRadius="medium"
                    padding="medium"
                    height="40%"
                    width="50%"
                    alignment="middle center"
                  >
                  <vstack alignment='middle center' height={30}><text size="large" weight="bold">🥳 LEADERBOARD 🥳</text>
                    {leaderboardData.map((entry, index) => (
                      <text key={index.toString()}>{index + 1}. {entry}</text>
                    ))}</vstack>
                    
                  </vstack>
                )}

              </vstack>
            </zstack>
        
        </vstack>
        <vstack grow={webviewVisible} height={webviewVisible ? '100%' : '0%'}>
          <vstack border="thick" borderColor="black" height={webviewVisible ? '100%' : '0%'}>
            <webview
              id="myWebView"
              url="page.html"
              onMessage={(msg) => onMessage(msg as WebViewMessage)}
              grow
              height={webviewVisible ? '100%' : '0%'}
            />
          </vstack>
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;
