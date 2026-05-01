def test_health_returns_ok(http_client):
    response = http_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
