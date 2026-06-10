# Deployment — Kubernetes, Helm, Istio, Multi-region (v2.3)

## Kubernetes (raw manifests)

```bash
# Validate YAML locally
make k8s-validate

# Apply (requires kubectl + cluster)
kubectl apply -f deploy/kubernetes/namespace.yaml
kubectl apply -f deploy/kubernetes/configmap.yaml
kubectl apply -f deploy/kubernetes/pvc.yaml
kubectl apply -f deploy/kubernetes/deployment-backend.yaml
kubectl apply -f deploy/kubernetes/deployment-fastapi.yaml
kubectl apply -f deploy/kubernetes/service.yaml
kubectl apply -f deploy/kubernetes/hpa.yaml
kubectl apply -f deploy/kubernetes/ingress.yaml

# Secrets — copy and edit before apply
cp deploy/kubernetes/secret.example.yaml deploy/kubernetes/secret.yaml
# edit deploy/kubernetes/secret.yaml
kubectl apply -f deploy/kubernetes/secret.yaml
```

Services: Flask backend `:8000`, FastAPI `:8001`, HPA on CPU, Ingress for `/` and `/modern/`.

## Helm

```bash
make helm-template   # dry-run render

helm install cinesentiment deploy/helm/cinesentiment \
  --namespace cinesentiment --create-namespace \
  -f deploy/helm/cinesentiment/values.yaml
```

Override image, replicas, and ingress host in `values.yaml`.

## Istio service mesh

```bash
make k8s-apply-istio
# Requires Istio installed: istioctl install --set profile=demo
```

## Multi-region (Helm)

```bash
make helm-us-east    # values-us-east.yaml
make helm-eu-west    # values-eu-west.yaml
kubectl apply -f deploy/kubernetes/multi-region/geo-ingress.yaml
```

## Local Kind cluster

```bash
make kind-up
```

## vLLM / Triton (inference backends)

```bash
docker compose --profile triton up    # Triton :8003
docker compose --profile vllm up      # vLLM :8002 (GPU recommended)
# INFERENCE_BACKEND=triton|vllm on backend service
```

## Docker (local)

```bash
make frontend-react-build   # optional — serves /modern/
docker compose up
```
