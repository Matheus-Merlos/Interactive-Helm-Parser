type KubernetesMetadata = {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  [key: string]: unknown;
};

type KubernetesManifest = {
  apiVersion: string;
  kind: string;
  metadata: KubernetesMetadata;
  spec: Record<string, unknown>;
  [key: string]: unknown;
};

export type { KubernetesManifest };
