# TripTrace Helm Chart

This chart deploys TripTrace with a service, optional persistent storage, ingress, and production environment settings.

## Usage

```sh
helm install triptrace ./charts/triptrace \
  --set image.repository=YOUR_REGISTRY/triptrace \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=yourdomain.com
```

See `values.yaml` for configuration options. Set strong secrets and configure `ALLOWED_ORIGINS` before production use.
