using UnityEngine;
using UnityEngine.UI;

public class ToggleChatButtonController : MonoBehaviour
{
    [SerializeField] private Button toggleChatButton;
    [SerializeField] private GameObject chatPanel;

    private bool chatPanelVisible = true;

    private void Start()
{
    if (toggleChatButton != null)
    {
        toggleChatButton.onClick.AddListener(ToggleChatPanel);
    }
    else
    {
        Debug.LogError("ToggleChatButton is not assigned in the ToggleChatButtonController script.");
    }

    // Add this line to make the ChatPanel start hidden
    chatPanel.SetActive(false);
    chatPanelVisible = false;
}

    private void ToggleChatPanel()
    {
        chatPanelVisible = !chatPanelVisible;
        chatPanel.SetActive(chatPanelVisible);
    }
}
