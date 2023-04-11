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

                // Parse the timestamp in "hours:minutes:seconds.milliseconds" format
                string[] timeParts = parts[1].Split(':');
                float hours = float.Parse(timeParts[0]);
                float minutes = float.Parse(timeParts[1]);
                float seconds = float.Parse(timeParts[2]);
                float timestamp = hours * 3600 + minutes * 60 + seconds;

                // Add the timestamp to the list
                lineTimestamps.Add(timestamp);

                // Get the lyrics line text
                string lyricsLineText = parts[9].Trim();

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
        while (audioSource.isPlaying)
        {
            float currentTime = audioSource.time;

            // Determine which line to display
            int currentLineIndex = 0;
            for (int i = 0; i < lineTimestamps.Count; i++)
            {
                if (currentTime >= lineTimestamps[i])
                {
                    currentLineIndex = i;
                }
                else
                {
                    break;
                }
            }

            // Display the current line and hide the others
            for (int i = 0; i < lyricsLines.Count; i++)
            {
                lyricsLines[i].gameObject.SetActive(i == currentLineIndex);
            }

            yield return null;
        }
    }
}
