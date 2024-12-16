class Game {
  constructor() {
    const describeUserButton = document.querySelector('#btn-describe-user');
    const descriptionOutput = document.querySelector('#descriptionOutput');

    const commentOutput = document.querySelector('#commentOutput');
    const summaryOutput = document.querySelector('#summaryOutput');
    const fetchCommentButton = document.querySelector('#btn-fetch-comment');
    const shareCommentButton = document.querySelector('#btn-share-comment');
    const moodToneInputs = document.querySelectorAll('input[name="moodTone"]');
    const topScoreComment = document.querySelector('#topScoreComment');

    let selectedMoodTone = 'positive'; // Default mood tone

    // Update the selected mood tone when a radio button is clicked
    moodToneInputs.forEach((input) => {
      input.addEventListener('change', () => {
        selectedMoodTone = input.value;
      });
    });

    // Event listener for the fetch comment button
    fetchCommentButton.addEventListener('click', () => {
      const selectedMoodTone = document.querySelector('input[name="moodTone"]:checked').value;
      window.parent?.postMessage(
        { type: 'fetchComment', data: { moodTone: selectedMoodTone } },
        '*'
      );
      fetchCommentButton.disabled = true;
      fetchCommentButton.textContent = 'Wait for It...';
    });

    window.parent?.postMessage({ type: 'fetchTopScoreComment' }, '*');

    // Event listener for the "Share to Comment" button
    shareCommentButton.addEventListener('click', () => {
      const summary = summaryOutput.textContent;
      
      if (summary && summary !== 'No summary available.') {
        // Send the summary to the parent window
        window.parent?.postMessage(
          { type: 'shareComment', data: { summary } },
          '*'
        );
    
        // Disable the button and change its text to "Shared"
        shareCommentButton.disabled = true;
        shareCommentButton.textContent = 'Shared';
        shareCommentButton.style.backgroundColor = 'lightblue';
      } else {
        alert('No summary available to share.');
      }
    });
    
    



    // Event listener for the describe user button
    describeUserButton.addEventListener('click', () => {
      window.parent?.postMessage({ type: 'userDescription' }, '*');
      // Disable the button and change its text to "Described"
      describeUserButton.disabled = true;
      describeUserButton.textContent = 'Wait for It...';
      describeUserButton.style.backgroundColor = '#ccc';
      describeUserButton.style.color = '#333';
    });

    this.score = 0;
    this.scoreDisplay = document.getElementById('totalScore');
    this.gameStatus = 'false';

    // Timer variables
    this.countdownTime = 150;
    this.timerInterval = null;
    this.timerDisplay = document.getElementById('timerDisplay');

    // Predefined sentences (comment out since they will be replaced)
    this.sentences = [];

    // Variable to store the random comment
    this.randomComment = '';

    // Pick a random sentence
    this.pickRandomSentence();

    // Submit button listener
    document.getElementById('submitAnswer').addEventListener('click', () => this.submitAnswer());

    // Timer logic
    this.startCountdown();

    this.updateCorrectness(); // Display initial correctness


    // Listen for messages from Devvit
    window.addEventListener('message', (ev) => {
      const { type, data } = ev.data;
      if (type === 'devvit-message') {
        const { message } = data;

        if (message.type === 'fetchedComment') {
          const comment = message.data.comment || 'No comment available.';
          commentOutput.textContent = comment;

          const summary = message.data.summary || 'No summary available.';
          summaryOutput.textContent = summary;

          if (summary && summary !== 'No summary available.') {
            shareCommentButton.style.display = 'inline-block';
            fetchCommentButton.textContent = 'Fetched. Try Again Later.';
          }
        }
      
        if (message.type === 'fetchTopScoreComment') {
          // Ensure the top score comment is displayed
          const topComment = message.data.comment || 'No top score comment available.';
          const topCommentAuthor = message.data.author || 'Unknown author';
          topScoreComment.textContent = `${topComment}`;
        }

        if (message.type === 'userDescription') {
          const description = message.data.description || 'No description available.';
          descriptionOutput.textContent = description;
          this.displayUserImage(description);
          describeUserButton.textContent = 'Loaded. Try Again Later.';
        }

        if (message.type === 'fetchRandomComment') {
          this.randomComment = message.data.comment || 'No comment available.';
          console.log('Received random comment:', this.randomComment);
          this.pickRandomSentence();  // Update the sentence with the random comment
        }

        console.log('Received from Devvit:', message);

        // Ensure the score is updated when it's available
        if (message.data && message.data.currentScore !== undefined) {
          this.score = message.data.currentScore; // Assume the message contains the current score
          this.updateScoreDisplay();
        }
      }
    });

    // Request random comment from parent window
    window.parent?.postMessage({ type: 'fetchRandomComment' }, '*');
  }
  

  updateScoreDisplay() {
    this.scoreDisplay.innerText = `Score: ${this.score}`;
  }

    // Function to display image based on user persona
  displayUserImage(description) {
      const imageMapping = {
        "meme maker": "images/meme-maker.jpg",
        "knowledge seeker": "images/knowledge-seeker.jpg",
        "commentator": "images/commentator.jpg",
        "supportive user": "images/supportive-user.jpg",
        "casual lurker": "images/casual-lurker.jpg",
        "troll": "images/troll.jpg",
        "content curator": "images/content-curator.jpg",
        "debate enthusiast": "images/debate-enthusiast.jpg",
        "hobbyist": "images/hobbyist.jpg",
        "critic": "images/critic.jpg",
        "newbie": "images/newbie.jpg",
        "builder": "images/builder.jpg"
      };

      const normalizedDescription = description.trim().toLowerCase();
      const userImageOutput = document.getElementById('userImageOutput');


      if (imageMapping[normalizedDescription]) {
        
        userImageOutput.src = imageMapping[normalizedDescription];
        userImageOutput.alt = description;
        userImageOutput.style.display = 'block';
      } else {
        userImageOutput.style.display = 'none';
      }
    }

  

  pickRandomSentence() {
    const sentenceToUse = this.randomComment || "The quick brown fox jumps over the lazy dog"; // Fallback if no comment
    const shuffledWords = this.shuffleWords(sentenceToUse);
    const levelQuestion = document.getElementById('levelQuestion');
    levelQuestion.innerHTML = '';

    shuffledWords.forEach((word) => {
      const wordBox = document.createElement('div');
      wordBox.className = 'word-box';
      wordBox.draggable = true;
      wordBox.innerText = word;
      wordBox.addEventListener('dragstart', (e) => this.dragStart(e));
      wordBox.addEventListener('dragover', (e) => this.dragOver(e));
      wordBox.addEventListener('drop', (e) => this.drop(e));
      levelQuestion.appendChild(wordBox);
    });

    this.correctSentence = sentenceToUse;
  }

  shuffleWords(sentence) {
    // Trim the sentence and filter out any blank spaces from splitting
    const words = sentence.trim().split(/\s+/); // Split by one or more spaces
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]]; 
    }
    return words;
  }
  
  startCountdown() {
    this.countdownTime = 150;
    this.updateTimerDisplay();

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      if (this.countdownTime > 0) {
        this.countdownTime--;
        this.updateTimerDisplay();
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  updateTimerDisplay() {
    this.timerDisplay.innerText = `Time: ${this.countdownTime}s`;
  }

  submitAnswer() {
    const submitAnswer = document.querySelector('#submitAnswer');
    const levelQuestion = document.querySelector('#levelQuestion');
  
    // Collect the user's answer from the DOM
    const answer = Array.from(levelQuestion.children)
                        .map((wordBox) => wordBox.innerText.trim())
                        .join(' ');
  
    // Normalize both strings
    const normalizedAnswer = answer.replace(/\s+/g, ' ').trim().toLowerCase(); // Single spaces, no extra spaces
    const normalizedCorrect = this.correctSentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  
    if (normalizedAnswer === normalizedCorrect) {
      this.scoreDisplay.style.backgroundColor = 'green';

      setTimeout(() => {
        this.scoreDisplay.style.backgroundColor = ''; // Reset to default color
      }, 2000); // 2000 milliseconds = 2 seconds
      this.moveToNextSentence();
    } else {
      // Provide feedback for incorrect answers
      submitAnswer.classList.add('shake');
      setTimeout(() => {
        submitAnswer.classList.remove('shake');
      }, 500);
  
      // Optionally log for debugging
      console.log(`Your answer: "${answer}"`);
      console.log(`Correct answer: "${this.correctSentence}"`);
    }
  }

  

  updateCorrectness() {
    const levelQuestion = document.querySelector('#levelQuestion');
    const correctnessDisplay = document.querySelector('#correctness');
  
    // Get the current word order from the DOM
    const currentOrder = Array.from(levelQuestion.children)
                              .map((wordBox) => wordBox.innerText.trim());
  
    // Normalize the correct sentence and split into words
    const correctOrder = this.correctSentence.split(/\s+/);
  
    // Calculate correctness
    const totalWords = correctOrder.length;
    let correctCount = 0;
  
    currentOrder.forEach((word, index) => {
      if (word === correctOrder[index]) {
        correctCount++;
      }
    });
  
    const correctnessPercentage = Math.round((correctCount / totalWords) * 100);

    if (correctnessPercentage == 100) {
      correctnessDisplay.style.backgroundColor = 'green';
    } else if (correctnessPercentage >= 50) {
      correctnessDisplay.style.backgroundColor = 'orange';
    } else {
      correctnessDisplay.style.backgroundColor = '';
    }
  
    // Update the correctness display
    correctnessDisplay.innerText = `Correctness: ${correctnessPercentage}%`;
  }
  
  
  

  moveToNextSentence() {
    if (this.countdownTime > 0) {
      this.score += 10 + this.countdownTime;
    }
  
    this.updateScoreDisplay();
    this.pickRandomSentence();
    this.updateCorrectness();

  
    // Reset the countdown and score for the next round
    this.startCountdown();
  
    // Post the updated score to Devvit
    this.postScoreToDevvit();
  }
  

  postScoreToDevvit() {
    // Post score update to Devvit (parent window)
    window.parent.postMessage({
      type: 'updateScore',
      data: { score: this.score },
    }, '*');
  }

  dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.innerText);
    e.target.classList.add('dragging');
  }

  dragOver(e) {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    const target = e.target;
    if (target.classList.contains('word-box') && target !== dragging) {
      const levelQuestion = document.getElementById('levelQuestion');
      levelQuestion.insertBefore(dragging, target);
    }
  }

  drop(e) {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    dragging.classList.remove('dragging');
  
    const target = e.target;
    const levelQuestion = document.getElementById('levelQuestion');
  
    if (target.classList.contains('word-box') && target !== dragging) {
      levelQuestion.insertBefore(dragging, target);
    }
  
    // Update correctness after the drop
    this.updateCorrectness();
  }
  
}



document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();

  // Tab switch logic
  const gameTab = document.getElementById('game-tab');
  const haikuTab = document.getElementById('fetch-comment');
  const describeUserTab = document.getElementById('describe-user');

  // Event listener for tab switches
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Hide all tab contents
      [gameTab, haikuTab, describeUserTab].forEach(tabContent => {
        tabContent.style.display = 'none';
      });

      // Show the selected tab
      if (tab.dataset.tab === 'game-tab') {
        gameTab.style.display = 'block';
      } else if (tab.dataset.tab === 'fetch-comment') {
        haikuTab.style.display = 'block';
      } else if (tab.dataset.tab === 'describe-user') {
        describeUserTab.style.display = 'block';
      } 

      // Update active tab
      document.querySelectorAll('.tabs .tab').forEach(activeTab => {
        activeTab.classList.remove('active');
      });
      tab.classList.add('active');
    });
  });
});
