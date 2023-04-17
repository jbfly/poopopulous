using UnityEngine;

[CreateAssetMenu(fileName = "APIKeySO", menuName = "API Key", order = 1)]
public class APIKeySO : ScriptableObject
{
    [SerializeField] private string apiKey;
    public string ApiKey => apiKey;
}