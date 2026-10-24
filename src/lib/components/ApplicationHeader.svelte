<script lang="ts">
  import { Bolt, Upload } from 'lucide-svelte';

  type Props = {
    onChartUpload: (event: Event) => void;
    fileName?: string;
    releaseName?: string;
    releaseNamespace?: string;
  };

  let {
    onChartUpload,
    fileName = $bindable(''),
    releaseName = $bindable(''),
    releaseNamespace = $bindable(''),
  }: Props = $props();
</script>

<header class="header">
  <div class="icon-container">
    <img src="img/helm.png" alt="Helm Icon" id="icon" />
    <h1>Helm Lab</h1>
  </div>
  <div class="upload-container">
    <input
      type="file"
      id="tar-upload"
      class="hidden-input"
      accept=".tar.gz,.tgz"
      onchange={onChartUpload}
    />
    <label for="tar-upload" class="upload-button">
      <Upload size={18} />
      <span>{fileName ? fileName : 'Upload Chart'}</span>
    </label>
  </div>
  <div class="other-inputs-container">
    <sl-input
      label="Release Name"
      filled
      placeholder="Release name..."
      size="small"
      class="sl-header-input"
      value={releaseName}
      oninput={(e: Event) => (releaseName = (e.target as HTMLInputElement).value)}
    >
    </sl-input>
    <sl-input
      label="Namespace"
      filled
      placeholder="Namespace..."
      size="small"
      class="sl-header-input"
      value={releaseNamespace}
      oninput={(e: Event) => (releaseNamespace = (e.target as HTMLInputElement).value)}
    >
    </sl-input>
  </div>
  <div class="settings-container">
    <button class="settings">
      <Bolt size="100%" />
    </button>
  </div>
</header>

<style>
  .header {
    display: grid;
    height: 100px;
    align-items: center;
    grid-template-columns: 1.35fr 0.5fr 1fr auto;
    gap: 1.5rem;
    padding: 0 1.5rem;

    flex-shrink: 0;

    background-color: var(--header-purple);

    h1 {
      font-family: 'Noto Sans', sans-serif;
      font-weight: bolder;
      font-size: 24pt;
      color: var(--smooth-white);
    }
  }

  .icon-container {
    display: flex;
  }
  .other-inputs-container {
    display: flex;
    gap: 1rem;
    width: 100%;
  }
  #icon {
    object-fit: contain;
    width: 72px;
    padding-right: 15px;
  }

  /* upload hbutton */
  .hidden-input {
    display: none;
  }
  .upload-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background-color: var(--light-blue);
    padding: 10px 18px;
    border-radius: 8px;
    user-select: none;

    max-width: 250px;
    overflow: hidden;

    font-family: 'Inter', 'arial', sans-serif;
    transition:
      background-color 0.2s ease,
      transform 0.1s ease;

    &:hover {
      cursor: pointer;
      background-color: color-mix(in srgb, var(--light-blue) 65%, white);
    }

    &:active {
      transform: scale(0.975);
    }

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  /* Other header inputs */
  .sl-header-input {
    flex: 1;

    --sl-input-label-color: var(--light-blue);

    &::part(base) {
      background-color: rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      transition: border-color 0.2s ease;
    }

    &::part(base):hover {
      border-color: var(--light-blue);
    }

    &::part(base):focus-within {
      border-color: var(--light-blue);
      box-shadow: 0 0 0 2px rgba(61, 196, 202, 0.2);
    }
  }
  .settings {
    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 50%;
    border: none;
    background-color: transparent;
    color: var(--smooth-white);

    width: 45px;
    height: 45px;

    transition: background-color 0.15s ease;

    &:hover {
      cursor: pointer;
      background-color: rgba(255, 255, 255, 0.05);
    }
  }
  .settings-container {
    display: flex;
    justify-content: end;
    height: 100%;
    align-items: center;
  }
</style>
