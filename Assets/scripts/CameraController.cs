using System.Collections;
using UnityEngine;

public class CameraController : MonoBehaviour
{
    public float panSpeed = 20f;
    public float zoomSpeed = 20f;

    private Camera cam;

    void Start()
    {
        cam = GetComponent<Camera>();
    }

    void Update()
    {
        // Zoom
        float scrollInput = Input.GetAxis("Mouse ScrollWheel");
        cam.orthographicSize = Mathf.Clamp(cam.orthographicSize - scrollInput * zoomSpeed * Time.deltaTime, .1f, 100f);

        // Pan
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        // Calculate the pan movement based on the camera's local right and local forward vectors
        Vector3 panMovement = (cam.transform.right * horizontal + cam.transform.forward * vertical) * panSpeed * Time.deltaTime;

        // Remove any vertical movement component from the pan movement
        panMovement.y = 0;

        transform.Translate(panMovement, Space.World);

        // Rotate
        if (Input.GetKeyDown(KeyCode.Q))
        {
            RotateCameraAroundViewportCenter(90f);
        }
        if (Input.GetKeyDown(KeyCode.E))
        {
            RotateCameraAroundViewportCenter(-90f);
        }
    }

    void RotateCameraAroundViewportCenter(float targetRotation)
    {
        // Create a layer mask for the ground plane
        int groundLayerMask = 1 << LayerMask.NameToLayer("Ground");

        // Raycast from the camera's viewport center to the ground plane
        Ray ray = cam.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0));
        RaycastHit hit;

        // Check if the raycast hits the ground plane using the layer mask
        if (Physics.Raycast(ray, out hit, Mathf.Infinity, groundLayerMask))
        {
            // Use the hit point on the ground plane as the pivot point
            Vector3 pivotPoint = hit.point;

            // Compute the relative position of the camera to the pivot point
            Vector3 relativePosition = transform.position - pivotPoint;

            // Rotate the relative position by the target rotation
            relativePosition = Quaternion.Euler(0, targetRotation, 0) * relativePosition;

            // Update the camera's position by adding the rotated relative position back to the pivot point
            transform.position = pivotPoint + relativePosition;

            // Rotate the camera itself
            transform.Rotate(Vector3.up, targetRotation, Space.World);
        }
    }
}
