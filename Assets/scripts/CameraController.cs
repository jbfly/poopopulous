using UnityEngine;

public class CameraController : MonoBehaviour
{
    public float panSpeed = 20f;
    public float zoomSpeed = 20f;
    public float rotationSpeed = 90f;

    private Camera cam;

    void Start()
    {
        cam = GetComponent<Camera>();
    }

    void Update()
{
    // Zoom
    float scrollInput = Input.GetAxis("Mouse ScrollWheel");
    cam.orthographicSize = Mathf.Clamp(cam.orthographicSize - scrollInput * zoomSpeed * Time.deltaTime, 1f, 100f);

    // Pan
    float horizontal = Input.GetAxis("Horizontal");
    float vertical = Input.GetAxis("Vertical");

    // Negate the vertical input to reverse up/down panning
    Vector3 panMovement = new Vector3(horizontal, 0, vertical) * panSpeed * Time.deltaTime;

    // Rotate panMovement by 135 degrees around the Y-axis
    panMovement = Quaternion.Euler(0, 135, 0) * panMovement;

    transform.Translate(panMovement, Space.World);

    // Rotate
    if (Input.GetKey(KeyCode.Q))
    {
        transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime, Space.World);
    }
    if (Input.GetKey(KeyCode.E))
    {
        transform.Rotate(Vector3.up, -rotationSpeed * Time.deltaTime, Space.World);
    }
}



}
