#!/usr/bin/env python3
"""
RuVector Dataset Converter
Converts various dataset formats to RuVector-compatible Cypher and vector formats.

Usage:
    python convert-to-ruvector.py --dataset sift1m --input data/vectors/sift --output ruvector-import/
    python convert-to-ruvector.py --dataset ogbn-papers100M --input data/graphs/ogb --output ruvector-import/
"""

import argparse
import json
import numpy as np
import struct
from pathlib import Path
from typing import List, Dict, Any
import sys

def log(msg: str, level: str = "INFO"):
    colors = {"INFO": "\033[0;32m", "WARN": "\033[1;33m", "ERROR": "\033[0;31m", "RESET": "\033[0m"}
    print(f"{colors.get(level, '')}[{level}]{colors['RESET']} {msg}")

class DatasetConverter:
    def __init__(self, input_dir: Path, output_dir: Path):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def read_fvecs(self, filename: Path) -> np.ndarray:
        """Read .fvecs file format (used by SIFT, GIST, DEEP)"""
        vectors = []
        with open(filename, 'rb') as f:
            while True:
                dim_bytes = f.read(4)
                if not dim_bytes:
                    break
                dim = struct.unpack('i', dim_bytes)[0]
                vec = struct.unpack('f' * dim, f.read(4 * dim))
                vectors.append(vec)
        return np.array(vectors)

    def read_ivecs(self, filename: Path) -> np.ndarray:
        """Read .ivecs file format (ground truth)"""
        vectors = []
        with open(filename, 'rb') as f:
            while True:
                dim_bytes = f.read(4)
                if not dim_bytes:
                    break
                dim = struct.unpack('i', dim_bytes)[0]
                vec = struct.unpack('i' * dim, f.read(4 * dim))
                vectors.append(vec)
        return np.array(vectors)

    def convert_sift1m(self):
        """Convert SIFT1M to RuVector format"""
        log("Converting SIFT1M dataset...")

        # Read vectors
        base_file = self.input_dir / "sift" / "sift_base.fvecs"
        query_file = self.input_dir / "sift" / "sift_query.fvecs"
        ground_truth_file = self.input_dir / "sift" / "sift_groundtruth.ivecs"

        if not base_file.exists():
            log(f"Base file not found: {base_file}", "ERROR")
            return False

        log("Reading base vectors (1M x 128)...")
        base_vectors = self.read_fvecs(base_file)
        log(f"Loaded {len(base_vectors)} base vectors")

        log("Reading query vectors...")
        query_vectors = self.read_fvecs(query_file)
        log(f"Loaded {len(query_vectors)} query vectors")

        log("Reading ground truth...")
        ground_truth = self.read_ivecs(ground_truth_file)
        log(f"Loaded ground truth for {len(ground_truth)} queries")

        # Export to RuVector JSON format
        output = {
            "dataset": "sift1m",
            "dimensions": 128,
            "metric": "euclidean",
            "base_vectors": base_vectors.tolist(),
            "query_vectors": query_vectors.tolist(),
            "ground_truth": ground_truth.tolist()
        }

        # Save as JSONL for efficient streaming
        jsonl_file = self.output_dir / "sift1m_base.jsonl"
        log(f"Writing base vectors to {jsonl_file}...")

        with open(jsonl_file, 'w') as f:
            for i, vec in enumerate(base_vectors):
                record = {
                    "id": f"sift_{i}",
                    "vector": vec.tolist(),
                    "metadata": {"index": i}
                }
                f.write(json.dumps(record) + '\n')

        # Save queries separately
        query_file_out = self.output_dir / "sift1m_queries.jsonl"
        with open(query_file_out, 'w') as f:
            for i, (query, gt) in enumerate(zip(query_vectors, ground_truth)):
                record = {
                    "id": f"query_{i}",
                    "vector": query.tolist(),
                    "ground_truth": gt.tolist()
                }
                f.write(json.dumps(record) + '\n')

        log(f"SIFT1M conversion complete!", "INFO")
        log(f"Import to RuVector with:", "INFO")
        log(f"  ruvector-cli import --format jsonl --file {jsonl_file}", "INFO")
        return True

    def convert_ogb_papers100m(self):
        """Convert ogbn-papers100M to RuVector Cypher format"""
        log("Converting ogbn-papers100M dataset...")

        try:
            from ogb.nodeproppred import NodePropPredDataset
        except ImportError:
            log("ogb package not installed. Run: pip install ogb", "ERROR")
            return False

        log("Loading OGB dataset (this may take a few minutes)...")
        dataset = NodePropPredDataset(name="ogbn-papers100M", root=str(self.input_dir))

        graph, labels = dataset[0]
        split_idx = dataset.get_idx_split()

        num_nodes = graph['num_nodes']
        edge_index = graph['edge_index']
        node_feat = graph['node_feat']

        log(f"Loaded graph: {num_nodes} nodes, {edge_index.shape[1]} edges")

        # Generate Cypher CREATE statements
        cypher_file = self.output_dir / "papers100m.cypher"
        vectors_file = self.output_dir / "papers100m_vectors.jsonl"

        log(f"Writing Cypher statements to {cypher_file}...")

        with open(cypher_file, 'w') as cypher, open(vectors_file, 'w') as vectors:
            # Create nodes (sample first 100k for demo, full export would be huge)
            sample_size = min(100000, num_nodes)
            log(f"Creating {sample_size} node statements (sampling from {num_nodes})...")

            for i in range(sample_size):
                label = labels[i][0] if i < len(labels) else -1
                cypher.write(f"CREATE (n{i}:Paper {{id: {i}, label: {label}}});\n")

                # Write vector separately
                if i < len(node_feat):
                    vec_record = {
                        "node_id": i,
                        "vector": node_feat[i].tolist()
                    }
                    vectors.write(json.dumps(vec_record) + '\n')

                if (i + 1) % 10000 == 0:
                    log(f"Processed {i + 1}/{sample_size} nodes...")

            # Create edges (sample)
            log("Creating edge statements...")
            sample_edges = min(100000, edge_index.shape[1])

            for i in range(sample_edges):
                src, dst = edge_index[0][i], edge_index[1][i]
                if src < sample_size and dst < sample_size:
                    cypher.write(f"MATCH (a:Paper {{id: {src}}}), (b:Paper {{id: {dst}}}) "
                               f"CREATE (a)-[:CITES]->(b);\n")

                if (i + 1) % 10000 == 0:
                    log(f"Processed {i + 1}/{sample_edges} edges...")

        log("ogbn-papers100M conversion complete!", "INFO")
        log(f"Import to RuVector with:", "INFO")
        log(f"  ruvector-cli cypher < {cypher_file}", "INFO")
        log(f"  ruvector-cli import-vectors --file {vectors_file}", "INFO")
        return True

    def convert_reddit(self):
        """Convert Reddit Hyperlink Network to Cypher"""
        log("Converting Reddit Hyperlink Network...")

        tsv_file = self.input_dir / "reddit" / "soc-redditHyperlinks-title.tsv"
        if not tsv_file.exists():
            log(f"Reddit file not found: {tsv_file}", "ERROR")
            return False

        cypher_file = self.output_dir / "reddit.cypher"

        log(f"Reading {tsv_file}...")
        subreddits = set()
        edges = []

        with open(tsv_file, 'r') as f:
            header = f.readline()  # Skip header
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) >= 4:
                    src, dst, timestamp, sentiment = parts[0], parts[1], parts[2], parts[3]
                    subreddits.add(src)
                    subreddits.add(dst)
                    edges.append((src, dst, timestamp, sentiment))

        log(f"Found {len(subreddits)} subreddits, {len(edges)} hyperlinks")

        log(f"Writing Cypher to {cypher_file}...")
        with open(cypher_file, 'w') as f:
            # Create nodes
            for sub in subreddits:
                # Escape special characters in subreddit names
                safe_name = sub.replace("'", "\\'")
                f.write(f"MERGE (s:Subreddit {{name: '{safe_name}'}});\n")

            # Create edges
            for src, dst, ts, sentiment in edges:
                safe_src = src.replace("'", "\\'")
                safe_dst = dst.replace("'", "\\'")
                f.write(
                    f"MATCH (a:Subreddit {{name: '{safe_src}'}}), "
                    f"(b:Subreddit {{name: '{safe_dst}'}}) "
                    f"CREATE (a)-[:HYPERLINK {{timestamp: '{ts}', sentiment: '{sentiment}'}}]->(b);\n"
                )

        log("Reddit conversion complete!", "INFO")
        log(f"Import to RuVector with:", "INFO")
        log(f"  ruvector-cli cypher < {cypher_file}", "INFO")
        return True

    def convert_ogb_molhiv(self):
        """Convert ogbg-molhiv to molecular graph Cypher"""
        log("Converting ogbg-molhiv dataset...")

        try:
            from ogb.graphproppred import GraphPropPredDataset
        except ImportError:
            log("ogb package not installed. Run: pip install ogb", "ERROR")
            return False

        log("Loading OGB dataset...")
        dataset = GraphPropPredDataset(name="ogbg-molhiv", root=str(self.input_dir))

        log(f"Loaded {len(dataset)} molecules")

        cypher_file = self.output_dir / "molhiv.cypher"

        log(f"Writing Cypher to {cypher_file}...")
        with open(cypher_file, 'w') as f:
            for idx, (graph, label) in enumerate(dataset):
                if idx >= 1000:  # Sample first 1000 molecules for demo
                    break

                node_feat = graph['node_feat']
                edge_index = graph['edge_index']
                edge_feat = graph['edge_feat']

                mol_id = f"mol_{idx}"
                hiv_active = bool(label[0])

                # Create molecule node
                f.write(f"CREATE (m{idx}:Molecule {{id: '{mol_id}', hiv_active: {hiv_active}}});\n")

                # Create atom nodes
                for atom_idx, feat in enumerate(node_feat):
                    atomic_num = int(feat[0])
                    f.write(
                        f"CREATE (a{idx}_{atom_idx}:Atom {{mol: '{mol_id}', "
                        f"atom_idx: {atom_idx}, atomic_num: {atomic_num}}});\n"
                    )

                # Create bonds
                for bond_idx in range(edge_index.shape[1]):
                    src, dst = edge_index[0][bond_idx], edge_index[1][bond_idx]
                    bond_type = int(edge_feat[bond_idx][0]) if len(edge_feat) > bond_idx else 0
                    f.write(
                        f"MATCH (a:Atom {{mol: '{mol_id}', atom_idx: {src}}}), "
                        f"(b:Atom {{mol: '{mol_id}', atom_idx: {dst}}}) "
                        f"CREATE (a)-[:BOND {{type: {bond_type}}}]->(b);\n"
                    )

                if (idx + 1) % 100 == 0:
                    log(f"Processed {idx + 1} molecules...")

        log("ogbg-molhiv conversion complete!", "INFO")
        log(f"Import to RuVector with:", "INFO")
        log(f"  ruvector-cli cypher < {cypher_file}", "INFO")
        return True

def main():
    parser = argparse.ArgumentParser(description="Convert datasets to RuVector format")
    parser.add_argument("--dataset", required=True,
                       choices=["sift1m", "ogbn-papers100M", "reddit", "ogbg-molhiv"],
                       help="Dataset to convert")
    parser.add_argument("--input", required=True, type=Path,
                       help="Input directory containing dataset")
    parser.add_argument("--output", required=True, type=Path,
                       help="Output directory for RuVector files")

    args = parser.parse_args()

    converter = DatasetConverter(args.input, args.output)

    converters = {
        "sift1m": converter.convert_sift1m,
        "ogbn-papers100M": converter.convert_ogb_papers100m,
        "reddit": converter.convert_reddit,
        "ogbg-molhiv": converter.convert_ogb_molhiv,
    }

    success = converters[args.dataset]()

    if success:
        log(f"\nConversion successful! Files written to {args.output}", "INFO")
        sys.exit(0)
    else:
        log(f"\nConversion failed!", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()
