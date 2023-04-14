using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PoopSpawner : MonoBehaviour
{
    public GameObject poopPrefab;
    public float spawnInterval = 0.95f;
    private float timeSinceLastSpawn;

    public AudioClip pooSound;
    private AudioSource audioSource;

    void Start()
    {
        audioSource = GetComponent<AudioSource>();
    }

    void Update()
    {
        timeSinceLastSpawn += Time.deltaTime;

        if (timeSinceLastSpawn >= spawnInterval)
        {
            SpawnPoop();
            timeSinceLastSpawn = 0f;
        }
    }

    void SpawnPoop()
    {
        timeSinceLastSpawn = 0f; // Reset the timeSinceLastSpawn variable at the beginning of the method
        float xPos = Random.Range(-.1f, .1f);
        float yPos = 1f;
        float zPos = Random.Range(-.1f, .1f);
        Vector3 spawnPosition = new Vector3(xPos, yPos, zPos);
        GameObject spawnedObject = Instantiate(poopPrefab, transform.position + spawnPosition, Quaternion.identity);
        audioSource.PlayOneShot(pooSound);

        // Debug lines
       // Collider spawnedCollider = spawnedObject.GetComponent<Collider>();
      //  Debug.Log("Spawned object collider: " + spawnedCollider);
     //   Debug.Log("Spawned object collider enabled: " + spawnedCollider.enabled);
    }

}
