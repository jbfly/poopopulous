using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using SimpleJSON;
using TMPro; // Add this line if you're using TextMeshPro

public class ChatManager : MonoBehaviour
{
    [SerializeField] private OpenAIAPIWrapper apiWrapper;
    [SerializeField] private TMP_InputField inputField; // Change this line for TextMeshPro
    [SerializeField] private Button sendButton;
    [SerializeField] private TextMeshProUGUI chatText; // Change this line for TextMeshPro

    private void Start()
{
    if (sendButton != null)
    {
        sendButton.onClick.AddListener(SendMessage);
    }
    else
    {
    //    Debug.LogError("SendButton is not assigned in the ChatManager script.");
    }
}
    private void SendMessage()
    {
        string message = inputField.text;
        if (string.IsNullOrEmpty(message)) return;

        chatText.text += "You: " + message + "\n";
        inputField.text = "";
        StartCoroutine(apiWrapper.SendMessageToGPT(message, response =>
        {
            string parsedResponse = ParseResponse(response);
            chatText.text += "GPT: " + parsedResponse + "\n";
        }));
    }

private string ParseResponse(string response)
{
    var jsonResponse = SimpleJSON.JSON.Parse(response);
    string generatedMessage = jsonResponse["choices"][0]["message"]["content"].Value.Trim(); // Update this line to get the "content" field
    Debug.Log("Parsed response: " + generatedMessage); // Print the parsed response
    return generatedMessage;
}
}