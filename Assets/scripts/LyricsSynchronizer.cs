using UnityEngine;
using TMPro;
using System.Collections;
using System.IO;
using System.Collections.Generic;
using System.Text.RegularExpressions;

public class LyricsSynchronizer : MonoBehaviour
{
    public RectTransform lyricsParent;
    public RectTransform poopEmoji;
    public AudioClip audioClip;
    public float[] lineDelays;
    public float wordDelay;
    public string lyricsFileName = "Never-Gonna-Poop-You-Up-Lyrics";


    private AudioSource audioSource;
    private List<TextMeshProUGUI> lyricsLines = new List<TextMeshProUGUI>();
    private List<float> lineEndTimestamps = new List<float>();

    private void Start()
    {
        // Load lyrics from the text file
        LoadLyrics();

        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.clip = audioClip;
        audioSource.Play();

        StartCoroutine(SyncLyrics());
    }

    private List<float> lineTimestamps = new List<float>();

    private void LoadLyrics()
    {
        TextAsset lyricsFile = Resources.Load<TextAsset>(lyricsFileName);
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

                // Remove formatting tags (like "{\k30}") from the text
                lyricsLineText = Regex.Replace(lyricsLineText, @"\{[^}]*\}", "");

                // Create a lyrics line
                TextMeshProUGUI lyricsLine = CreateLyricsLine();
                lyricsLine.text = lyricsLineText;
                lyricsLines.Add(lyricsLine);
            }
        }
    }

    private TextMeshProUGUI CreateLyricsLine()
    {
        GameObject lyricsLineObj = new GameObject("Lyrics Line");
        lyricsLineObj.transform.SetParent(lyricsParent, false);
        TextMeshProUGUI lyricsLine = lyricsLineObj.AddComponent<TextMeshProUGUI>();

        // Set the lyrics line properties (font, size, color, etc.) here

        // Adjust the size of the RectTransform
        RectTransform rectTransform = lyricsLine.GetComponent<RectTransform>();
        rectTransform.sizeDelta = new Vector2(800, 100); // Increase the height

        lyricsLine.color = Color.black;
        lyricsLine.enableWordWrapping = true;
        lyricsLine.alignment = TextAlignmentOptions.Midline;
        
        // Enable outline and set outline width and color
        lyricsLine.fontMaterial.EnableKeyword("OUTLINE_ON");
        lyricsLine.outlineWidth = 0.2f;
        lyricsLine.outlineColor = Color.white;

        // Scale the text
        float scaleFactor = 2.0f; // Adjust this value to scale the text
        lyricsLine.transform.localScale = new Vector3(scaleFactor, scaleFactor, scaleFactor);

        // Set font style to bold
        lyricsLine.fontStyle = FontStyles.Bold;

        return lyricsLine;
    }

    private IEnumerator SyncLyrics()
    {
        int currentLineIndex = 0;

        // Initially, hide all the lines
        foreach (TextMeshProUGUI line in lyricsLines)
        {
            line.gameObject.SetActive(false);
        }

        while (audioSource.isPlaying)
        {
            float currentTime = audioSource.time;

            // Display the lines when their start times are reached
            if (currentLineIndex < lineTimestamps.Count && currentTime >= lineTimestamps[currentLineIndex])
            {
                lyricsLines[currentLineIndex].gameObject.SetActive(true);
                currentLineIndex++;
            }

            // Hide the lines when their end times are reached
            for (int i = 0; i < currentLineIndex; i++)
            {
                if (currentTime >= lineEndTimestamps[i] && lyricsLines[i].gameObject.activeSelf)
                {
                    lyricsLines[i].gameObject.SetActive(false);
                }
            }

            yield return null;
        }
    }
}
