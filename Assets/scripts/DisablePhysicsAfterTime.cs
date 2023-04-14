using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DisablePhysicsAfterTime : MonoBehaviour
{
    public float disableTime = 5f;

    void Start()
    {
        StartCoroutine(DisablePhysics());
    }

    IEnumerator DisablePhysics()
    {
        yield return new WaitForSeconds(disableTime);

        // Set the Rigidbody component to kinematic
        Rigidbody rb = GetComponent<Rigidbody>();
        if (rb != null)
        {
            rb.isKinematic = true;
        }
    }
}