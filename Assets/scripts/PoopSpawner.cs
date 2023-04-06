using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PoopSpawner : MonoBehaviour
{
    public GameObject poopPrefab;
    public float spawnInterval = 1f;
    private float timeSinceLastSpawn;

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
    float xPos = Random.Range(-5f, 5f);
    float yPos = 1f; // Change this value according to the height you want the poop to spawn at
    float zPos = Random.Range(-5f, 5f);
    Vector3 spawnPosition = new Vector3(xPos, yPos, zPos);
    Instantiate(poopPrefab, transform.position + spawnPosition, Quaternion.identity);
}
}
