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
        Debug.LogError("SendButton is not assigned in the ChatManager script.");
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
    // Implement a parser to extract the generated message from the response JSON.
    // This example uses the SimpleJSON library for parsing. You can find it at:
    // https://github.com/Bunny83/SimpleJSON
    var jsonResponse = SimpleJSON.JSON.Parse(response);
    string generatedMessage = jsonResponse["choices"][0]["text"].Value.Trim();
    return generatedMessage;
}

}