using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class OpenAIAPIWrapper : MonoBehaviour
{
    [SerializeField] private string API_KEY = "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";
    private string API_URL = "https://api.openai.com/v1/engines/davinci-codex/completions";
    
    public IEnumerator SendMessageToGPT(string message, System.Action<string> callback)
    {
        string jsonBody = $"{{\"model\": \"text-davinci-002\", \"prompt\": \"{message}\", \"max_tokens\": 50, \"temperature\": 0.8, \"top_p\": 0.9, \"frequency_penalty\": 0, \"presence_penalty\": 0}}";
        
        UnityWebRequest request = new UnityWebRequest(API_URL, "POST");
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        request.SetRequestHeader("Authorization", "Bearer " + API_KEY);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            string response = request.downloadHandler.text;
            callback(response);
        }
        else
        {
            Debug.LogError("Request failed: " + request.error);
        }
    }
}
