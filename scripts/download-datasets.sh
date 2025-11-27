#!/bin/bash
#
# RuVector Dataset Downloader
# Downloads and prepares benchmark datasets for RuVector testing
#
# Usage:
#   ./download-datasets.sh [minimal|standard|full]
#
# Profiles:
#   minimal  - SIFT1M + ogbg-molhiv (~1GB)
#   standard - Add ogbn-papers100M + Reddit (~150GB)
#   full     - All datasets except AlphaFold full (~1TB)
#

set -e

# Configuration
PROFILE="${1:-minimal}"
DATA_DIR="${DATA_DIR:-./data}"
PARALLEL_DOWNLOADS="${PARALLEL_DOWNLOADS:-4}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create directory structure
setup_directories() {
    log_info "Creating directory structure in $DATA_DIR"
    mkdir -p "$DATA_DIR"/{vectors,graphs,streams,benchmarks}
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    local missing=()

    command -v wget >/dev/null 2>&1 || missing+=("wget")
    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v tar >/dev/null 2>&1 || missing+=("tar")
    command -v gunzip >/dev/null 2>&1 || missing+=("gunzip")
    command -v python3 >/dev/null 2>&1 || missing+=("python3")

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        log_info "Install with: sudo apt-get install ${missing[*]} (Debian/Ubuntu)"
        exit 1
    fi

    # Check Python packages
    if ! python3 -c "import ogb" 2>/dev/null; then
        log_warn "OGB package not installed. Installing..."
        pip install ogb
    fi
}

# Download SIFT1M
download_sift1m() {
    log_info "Downloading SIFT1M (500MB)..."

    local url="http://corpus-texmex.irisa.fr/sift.tar.gz"
    local output="$DATA_DIR/vectors/sift.tar.gz"

    if [ -f "$DATA_DIR/vectors/sift/sift_base.fvecs" ]; then
        log_warn "SIFT1M already exists, skipping"
        return 0
    fi

    wget -c "$url" -O "$output"
    tar -xzf "$output" -C "$DATA_DIR/vectors/"

    log_info "SIFT1M downloaded and extracted"
}

# Download DEEP1B
download_deep1b() {
    log_info "Downloading DEEP1B (WARNING: ~150GB total)..."

    local base_url="http://corpus-texmex.irisa.fr"

    if [ -f "$DATA_DIR/vectors/deep1b_base.fvecs" ]; then
        log_warn "DEEP1B already exists, skipping"
        return 0
    fi

    log_warn "This will download ~150GB. Press Ctrl+C to cancel, or wait 5 seconds..."
    sleep 5

    # Download base vectors (128GB)
    wget -c "$base_url/deep1b_base.fvecs" -O "$DATA_DIR/vectors/deep1b_base.fvecs" &

    # Download queries and ground truth
    wget -c "$base_url/deep1b_queries.fvecs" -O "$DATA_DIR/vectors/deep1b_queries.fvecs" &
    wget -c "$base_url/deep1b_groundtruth.ivecs" -O "$DATA_DIR/vectors/deep1b_groundtruth.ivecs" &

    wait

    log_info "DEEP1B downloaded"
}

# Download OGB datasets
download_ogb() {
    local dataset="$1"

    log_info "Downloading OGB dataset: $dataset..."

    python3 << EOF
from ogb.nodeproppred import NodePropPredDataset
from ogb.graphproppred import GraphPropPredDataset
import os

root = "$DATA_DIR/graphs/ogb"
os.makedirs(root, exist_ok=True)

dataset_name = "$dataset"

try:
    if dataset_name.startswith("ogbn-"):
        dataset = NodePropPredDataset(name=dataset_name, root=root)
    elif dataset_name.startswith("ogbg-"):
        dataset = GraphPropPredDataset(name=dataset_name, root=root)

    print(f"Downloaded {dataset_name}: {len(dataset)} samples")
except Exception as e:
    print(f"Error downloading {dataset_name}: {e}")
    exit(1)
EOF

    log_info "OGB $dataset downloaded"
}

# Download Reddit Hyperlink Network
download_reddit() {
    log_info "Downloading Reddit Hyperlink Network (50MB)..."

    local base_url="https://snap.stanford.edu/data"

    if [ -f "$DATA_DIR/graphs/reddit/soc-redditHyperlinks-title.tsv" ]; then
        log_warn "Reddit dataset already exists, skipping"
        return 0
    fi

    mkdir -p "$DATA_DIR/graphs/reddit"

    wget -c "$base_url/soc-redditHyperlinks-title.tsv" -O "$DATA_DIR/graphs/reddit/soc-redditHyperlinks-title.tsv"
    wget -c "$base_url/soc-redditHyperlinks-body.tsv" -O "$DATA_DIR/graphs/reddit/soc-redditHyperlinks-body.tsv"

    log_info "Reddit dataset downloaded"
}

# Download Wikidata sample
download_wikidata() {
    log_info "Downloading Wikidata sample (10M triples, ~5GB)..."

    if [ -f "$DATA_DIR/graphs/wikidata/wikidata-10m.json" ]; then
        log_warn "Wikidata sample already exists, skipping"
        return 0
    fi

    mkdir -p "$DATA_DIR/graphs/wikidata"

    log_warn "Downloading 10M triples from Wikidata SPARQL endpoint (this may take 10-30 minutes)..."

    curl -H "Accept: application/json" \
        'https://query.wikidata.org/sparql?query=SELECT%20%2A%20WHERE%20%7B%3Fs%20%3Fp%20%3Fo%7D%20LIMIT%2010000000' \
        > "$DATA_DIR/graphs/wikidata/wikidata-10m.json" 2>/dev/null || {
            log_error "Wikidata download failed. SPARQL endpoint may be rate-limited."
            log_info "Alternative: Download full dump from https://dumps.wikimedia.org/wikidatawiki/entities/"
            return 1
        }

    log_info "Wikidata sample downloaded"
}

# Download WikiArt
download_wikiart() {
    log_info "Downloading WikiArt dataset via HuggingFace..."

    if [ -d "$DATA_DIR/graphs/wikiart" ]; then
        log_warn "WikiArt already exists, skipping"
        return 0
    fi

    mkdir -p "$DATA_DIR/graphs/wikiart"

    python3 << EOF
from datasets import load_dataset
import os

output_dir = "$DATA_DIR/graphs/wikiart"

print("Loading WikiArt dataset (this may take a while)...")
dataset = load_dataset("huggan/wikiart")

print(f"Loaded {len(dataset['train'])} artworks")
print(f"Saving to {output_dir}")

# Save metadata
dataset.save_to_disk(output_dir)
print("WikiArt dataset saved")
EOF

    log_info "WikiArt downloaded"
}

# Generate summary
generate_summary() {
    log_info "Generating dataset summary..."

    cat > "$DATA_DIR/README.md" << 'EOF'
# RuVector Benchmark Datasets

Downloaded datasets for RuVector benchmarking and testing.

## Directory Structure

```
data/
├── vectors/          # Vector similarity datasets
│   ├── sift/         # SIFT1M (500MB)
│   └── deep1b/       # DEEP1B (~150GB)
├── graphs/           # Graph datasets
│   ├── ogb/          # Open Graph Benchmark
│   ├── reddit/       # Reddit Hyperlink Network
│   ├── wikidata/     # Wikidata sample
│   └── wikiart/      # WikiArt with CLIP embeddings
├── streams/          # Real-time streaming configs
└── benchmarks/       # Benchmark results
```

## Quick Start

### Import to RuVector

```bash
# SIFT1M vector search
ruvector-cli benchmark run --dataset sift1m --input data/vectors/sift

# ogbn-papers100M graph
ruvector-cli graph import --format ogb --dataset ogbn-papers100M --input data/graphs/ogb

# Reddit social graph
ruvector-cli graph import --format tsv --input data/graphs/reddit/soc-redditHyperlinks-title.tsv
```

### Run Benchmarks

```bash
# ANN-Benchmarks compatible
ruvector-cli benchmark ann --dataset sift-128-euclidean --output data/benchmarks/

# OGB node classification
ruvector-cli benchmark ogb --dataset ogbn-papers100M --output data/benchmarks/

# Custom hybrid benchmark
ruvector-cli benchmark custom --config hybrid-benchmark.yaml
```

## Dataset Details

See `docs/ruvector-dataset-benchmark-guide.md` for comprehensive documentation.

EOF

    log_info "Summary generated at $DATA_DIR/README.md"
}

# Main download logic
main() {
    log_info "RuVector Dataset Downloader"
    log_info "Profile: $PROFILE"
    log_info "Data directory: $DATA_DIR"

    setup_directories
    check_dependencies

    case "$PROFILE" in
        minimal)
            log_info "Downloading minimal dataset suite (~1GB)"
            download_sift1m
            download_ogb "ogbg-molhiv"
            ;;

        standard)
            log_info "Downloading standard dataset suite (~150GB)"
            download_sift1m
            download_ogb "ogbg-molhiv"
            download_ogb "ogbn-papers100M"
            download_reddit
            ;;

        full)
            log_info "Downloading full dataset suite (~1TB, no AlphaFold)"
            download_sift1m
            download_deep1b &
            download_ogb "ogbg-molhiv"
            download_ogb "ogbn-papers100M"
            download_reddit
            download_wikidata
            download_wikiart
            wait
            ;;

        *)
            log_error "Unknown profile: $PROFILE"
            echo "Usage: $0 [minimal|standard|full]"
            exit 1
            ;;
    esac

    generate_summary

    log_info "Download complete!"
    log_info "Next steps:"
    log_info "  1. Import datasets: ruvector-cli graph import --help"
    log_info "  2. Run benchmarks: ruvector-cli benchmark run --help"
    log_info "  3. See documentation: docs/ruvector-dataset-benchmark-guide.md"
}

# Run main function
main
