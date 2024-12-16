export async function GeminiFetcher(prompt: string): Promise<string> {
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };
  
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDk9vR36xxA5ljpEOa8-NpE_5N9G8cteK0', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      const result = data.candidates[0].content.parts[0].text;
      return result || 'No content found';
    } catch (error) {
      // You can handle the error here, e.g., log it, or return an error message
      return `Error fetching data: ${(error as Error).message}`;
    }
  };
  
  export default GeminiFetcher;
  