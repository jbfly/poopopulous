using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class OpenAIAPIWrapper : MonoBehaviour
{
    [SerializeField] private APIKeySO apiKeySO;
    private string API_KEY;
    private string API_URL = "https://api.openai.com/v1/chat/completions";
    
    void Start()
    {
        API_KEY = apiKeySO.ApiKey;
    }
    
    public IEnumerator SendMessageToGPT(string message, System.Action<string> callback)
    {
        string jsonBody = $"{{\"model\": \"gpt-3.5-turbo\", \"messages\": [{{\"role\": \"user\", \"content\": \"{message}\"}}], \"max_tokens\": 50, \"temperature\": 0.8, \"top_p\": 1, \"frequency_penalty\": 0, \"presence_penalty\": 0}}";
        
        using (UnityWebRequest request = new UnityWebRequest(API_URL, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", "Bearer " + API_KEY);
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                string response = request.downloadHandler.text;
                Debug.Log("Raw response: " + response); // Print the raw response
                callback(response);
            }
            else
            {
                Debug.LogError("Request failed: " + request.error);
            }
        }
    }
}
