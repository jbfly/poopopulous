using UnityEngine;
using UnityEngine.UI;

public class UnleashPoosButton : MonoBehaviour
{
    public PoopSpawner poopSpawner;
    private Button button;
    private bool isUnleashed = false;

    void Start()
    {
        button = GetComponent<Button>();
        button.onClick.AddListener(ToggleUnleashThePoos);
    }

    void ToggleUnleashThePoos()
{
    isUnleashed = !isUnleashed;

    // Comment out the lines below to simplify the script
    
    if (isUnleashed)
    {
        poopSpawner.spawnInterval = 0f;
      //  button.GetComponentInChildren<Text>().text = "Calm the Poos!";
    }
    else
    {
        poopSpawner.spawnInterval = 0.95f;
     //   button.GetComponentInChildren<Text>().text = "Unleash the Poos!";
    }
    
}
}