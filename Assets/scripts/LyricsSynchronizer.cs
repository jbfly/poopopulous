using UnityEngine;
using TMPro;
using System.Collections;
using System.Collections.Generic;
using System.Text.RegularExpressions;

public class LyricsSynchronizer : MonoBehaviour
{
    //Set these two in the Lyrics Synchronizer object thingy to run through Karaoke debugging
    public bool karaokeDebug;
    public int startFromLine;

    public RectTransform lyricsParent;
    public AudioClip audioClip;
    public TextAsset lyricsFile;
    public Color normalTextColor = Color.black;
    public Color highlightedTextColor = Color.yellow;

    private AudioSource audioSource;
    private List<List<LyricWord>> lyricsLines = new List<List<LyricWord>>();
    private List<float> lineEndTimestamps = new List<float>();

    private float maxLineWidth;

    private const float SpaceBetweenWords = 20f;
    private const float SpaceBetweenLines = 30f;

    private class LyricWord
    {
        public TextMeshProUGUI text;
        public float startTime;
        public float endTime;
    }

    private float GetLineWidth(bool isKaraokeLine)
    {
        return isKaraokeLine ? Screen.width * 0.5f : Screen.width;
        //return Screen.width;
    }

    private void Start()
    {
        maxLineWidth = GetLineWidth(false);

        lyricsParent.anchorMin = lyricsParent.anchorMax = new Vector2(0.5f, 0.5f);
        lyricsParent.pivot = new Vector2(0.5f, 0.5f);
        lyricsParent.anchoredPosition = Vector2.zero;

        // Load lyrics from the text file
        LoadLyrics();

        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.clip = audioClip;
        audioSource.Play();

        StartCoroutine(WaitForAudioToStart());
    }

    private IEnumerator WaitForAudioToStart()
    {
        while (!audioSource.isPlaying)
        {
            yield return null;
        }

        if (karaokeDebug && startFromLine < lineTimestamps.Count)
        {
            audioSource.time = lineTimestamps[startFromLine];
        }

        StartCoroutine(SyncLyrics());
    }

    private List<float> lineTimestamps = new List<float>();

    private void LoadLyrics()
    {
        string[] lines = lyricsFile.text.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            if (lines[i].StartsWith("Dialogue:"))
            {
                string[] parts = lines[i].Split(',');

                // Parse the start timestamp
                string[] startTimeParts = parts[1].Split(':');
                float startHours = float.Parse(startTimeParts[0]);
                float startMinutes = float.Parse(startTimeParts[1]);
                float startSeconds = float.Parse(startTimeParts[2]);
                float startTimestamp = startHours * 3600 + startMinutes * 60 + startSeconds;

                // Parse the end timestamp
                string[] endTimeParts = parts[2].Split(':');
                float endHours = float.Parse(endTimeParts[0]);
                float endMinutes = float.Parse(endTimeParts[1]);
                float endSeconds = float.Parse(endTimeParts[2]);
                float endTimestamp = endHours * 3600 + endMinutes * 60 + endSeconds;

                // Add the start and end timestamps to the lists
                lineTimestamps.Add(startTimestamp);
                lineEndTimestamps.Add(endTimestamp);

                // Get the lyrics line text
                string lyricsLineText = Regex.Match(lines[i], @"(?<=^[^,]*(?:,[^,]*){8},).*$").Value.Trim();

                // Check if the line has karaoke mode
                if (Regex.IsMatch(lyricsLineText, @"\{\\k\d+\}"))
                {
                    // Remove formatting tags (like "{\k30}") from the text
                    string plainText = Regex.Replace(lyricsLineText, @"\{[^}]*\}", "");

                    // For karaoke lines
                    List<LyricWord> words = CreateLyricsLine(lyricsLineText, startTimestamp, true);

                    // Add the words to the list of lyrics lines
                    lyricsLines.Add(words);
                }
                else
                {
                    // If the line doesn't have karaoke mode, create a single LyricWord for the entire line
                    LyricWord word = new LyricWord
                    {
                        text = CreateTextObject(lyricsLineText, Vector2.zero, false),
                        startTime = startTimestamp,
                        endTime = endTimestamp
                    };

                    // Add the word to the list of lyrics lines
                    lyricsLines.Add(new List<LyricWord> { word });
                }
            }
        }
    }

    private List<LyricWord> CreateLyricsLine(string inputText, float startTime, bool isKaraokeLine)
    {
        List<LyricWord> words = new List<LyricWord>();
        MatchCollection wordMatches = Regex.Matches(inputText, @"\{\\k(\d+)\}([^{]+)");

        float currentTime = startTime;
        maxLineWidth = GetLineWidth(isKaraokeLine);

        // Add a temporary TextMeshProUGUI object to measure the text width
        TextMeshProUGUI tempText = CreateTextObject("", Vector2.zero, false);
        float currentXPosition = 0;
        float currentYPosition = 0;
        float currentLineWidth = 0; // Keep track of the current line width

        float scaleFactor = 2.0f; // Same scale factor as in CreateTextObject()

        foreach (Match wordMatch in wordMatches)
        {
            float wordDuration = float.Parse(wordMatch.Groups[1].Value) / 100f;
            string wordText = wordMatch.Groups[2].Value;

            // Measure the text width
            tempText.text = wordText;
            float wordWidth = tempText.preferredWidth * scaleFactor; // Apply the scale factor

            // Check if there's enough room left on the current line
            if (currentXPosition + wordWidth + SpaceBetweenWords > maxLineWidth)
            {
                // Calculate the left padding for the current line
                float leftPadding = (Screen.width - currentLineWidth) / 2;

                // Update the anchor position for the words in the current line with the new left padding
                foreach (LyricWord existingWord in words)
                {
                    Vector2 anchorPosition = existingWord.text.rectTransform.anchoredPosition;

                    if (anchorPosition.y == currentYPosition) // Only update the words in the current line
                    {
                        anchorPosition.x += leftPadding;
                        existingWord.text.rectTransform.anchoredPosition = anchorPosition;
                    }
                }

                // Move to the next line
                currentXPosition = 0;
                currentYPosition -= tempText.preferredHeight + SpaceBetweenLines; // Add space between the lines
                currentLineWidth = 0; // Reset the current line width
            }

            // Create the word object with the calculated anchor position
            LyricWord word = new LyricWord
            {
                text = CreateTextObject(wordText, new Vector2(currentXPosition, currentYPosition), isKaraokeLine),
                startTime = currentTime,
                endTime = currentTime + wordDuration
            };

            // Add the word to the list of words
            words.Add(word);

            // Update the current time, X position, and current line width
            currentTime += wordDuration;
            currentXPosition += wordWidth + SpaceBetweenWords; // Add the word width and space between the words to the current line width
            currentLineWidth += wordWidth + SpaceBetweenWords;
        }

        // Calculate the left padding for the last line
        float lastLineLeftPadding = (Screen.width - currentLineWidth) / 2;

        // Update the anchor position for the words in the last line with the new left padding
        foreach (LyricWord existingWord in words)
        {
            Vector2 anchorPosition = existingWord.text.rectTransform.anchoredPosition;

            if (anchorPosition.y == currentYPosition) // Only update the words in the last line
            {
                anchorPosition.x += lastLineLeftPadding;
                existingWord.text.rectTransform.anchoredPosition = anchorPosition;
            }
        }

        // Destroy the temporary TextMeshProUGUI object
        Destroy(tempText.gameObject);

        return words;
    }

    private float CalculateLineWidth(List<LyricWord> words, float scaleFactor)
    {
        float totalWidth = 0;
        float maxLineWidth = 0;
        int wordCount = 0;

        foreach (LyricWord word in words)
        {
            float wordWidth = word.text.preferredWidth * scaleFactor; // Apply the scale factor

            if (totalWidth + wordWidth + SpaceBetweenWords > maxLineWidth)
            {
                maxLineWidth = totalWidth; // Save the width of the longest line
                totalWidth = 0; // Reset the total width for the new line
                wordCount = 0; // Reset the word count for the new line
            }

            totalWidth += wordWidth + (wordCount > 0 ? SpaceBetweenWords : 0);
            wordCount++;
        }

        // Check if the last line is longer than the previously saved maxLineWidth
        if (totalWidth > maxLineWidth)
        {
            maxLineWidth = totalWidth;
        }

        return maxLineWidth;
    }

    private TextMeshProUGUI CreateTextObject(string wordText, Vector2 anchorPosition, bool isKaraokeLine)
    {
        GameObject textObj = new GameObject("Lyric Word");
        textObj.transform.SetParent(lyricsParent, false);
        TextMeshProUGUI text = textObj.AddComponent<TextMeshProUGUI>();

        // Set the text properties (font, size, color, etc.) here

        // Set the maxLineWidth here
        maxLineWidth = GetLineWidth(isKaraokeLine);
        
        // Adjust the size of the RectTransform
        RectTransform rectTransform = text.GetComponent<RectTransform>();
        rectTransform.anchorMin = rectTransform.anchorMax = new Vector2(0.5f, 1);
        rectTransform.sizeDelta = new Vector2(maxLineWidth, 100); // Set the width to the screen width

        text.color = normalTextColor;
        text.enableWordWrapping = !isKaraokeLine; // Disable word wrapping for karaoke
        if (isKaraokeLine)
        {
            text.alignment = TextAlignmentOptions.Left;
        }
        else
        {
            text.alignment = TextAlignmentOptions.Midline;
        }

        // Enable outline and set outline width and color
        text.fontMaterial.EnableKeyword("OUTLINE_ON");
        text.outlineWidth = 0.2f;
        text.outlineColor = Color.white;

        // Scale the text
        float scaleFactor = 2.0f; // Adjust this value to scale the text
        text.transform.localScale = new Vector3(scaleFactor, scaleFactor, scaleFactor);

        // Set font style to bold
        text.fontStyle = FontStyles.Bold;

        // Set the anchor position
        rectTransform.anchoredPosition = anchorPosition;

        text.text = wordText;

        return text;
    }

    private IEnumerator SyncLyrics()
    {
        int currentLineIndex = 0;

        if (karaokeDebug)
        {
            currentLineIndex = startFromLine;
        }

        // Initially, hide all the words
        foreach (List<LyricWord> words in lyricsLines)
        {
            foreach (LyricWord word in words)
            {
                word.text.gameObject.SetActive(false);
            }
        }

        while (audioSource.isPlaying)
        {
            float currentTime = audioSource.time;

            // Display the words when their start times are reached
            if (currentLineIndex < lineTimestamps.Count && currentTime >= lineTimestamps[currentLineIndex])
            {
                foreach (LyricWord word in lyricsLines[currentLineIndex])
                {
                    word.text.gameObject.SetActive(true);
                    StartCoroutine(HighlightWord(word));
                }
                currentLineIndex++;
            }

            // Hide the words when their end times are reached
            for (int i = 0; i < currentLineIndex; i++)
            {
                if (currentTime >= lineEndTimestamps[i])
                {
                    foreach (LyricWord word in lyricsLines[i])
                    {
                        if (word.text.gameObject.activeSelf)
                        {
                            word.text.gameObject.SetActive(false);
                        }
                    }
                }
            }

            yield return null;
        }
    }


    private IEnumerator HighlightWord(LyricWord word)
    {
        yield return new WaitForSeconds(word.startTime - audioSource.time);
        word.text.color = highlightedTextColor;
        yield return new WaitForSeconds(word.endTime - word.startTime);
        word.text.color = normalTextColor;
    }
}