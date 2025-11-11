#!/usr/bin/env python3
"""
Python LangGraph Benchmark
Comparable to the Rust implementation benchmarks
"""

import time
import statistics
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage


class State(TypedDict):
    messages: list
    count: int


def simple_node(state: State) -> State:
    """Simple node that increments a counter"""
    return {"messages": state.get("messages", []), "count": state.get("count", 0) + 1}


def benchmark_graph_compilation(iterations=100):
    """Benchmark graph compilation time"""
    times = []

    for _ in range(iterations):
        start = time.perf_counter()

        # Build graph
        workflow = StateGraph(State)
        workflow.add_node("node1", simple_node)
        workflow.add_node("node2", simple_node)
        workflow.add_edge("node1", "node2")
        workflow.add_edge("node2", END)
        workflow.set_entry_point("node1")

        # Compile
        app = workflow.compile()

        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to ms

    return {
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "min": min(times),
        "max": max(times),
        "stdev": statistics.stdev(times) if len(times) > 1 else 0
    }


def benchmark_single_node_execution(iterations=100):
    """Benchmark single node execution"""
    # Setup
    workflow = StateGraph(State)
    workflow.add_node("node", simple_node)
    workflow.add_edge("node", END)
    workflow.set_entry_point("node")
    app = workflow.compile()

    times = []

    for _ in range(iterations):
        start = time.perf_counter()
        result = app.invoke({"messages": [], "count": 0})
        end = time.perf_counter()
        times.append((end - start) * 1000000)  # Convert to μs

    return {
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "min": min(times),
        "max": max(times),
        "stdev": statistics.stdev(times) if len(times) > 1 else 0
    }


def benchmark_multi_node_execution(node_count, iterations=50):
    """Benchmark execution with multiple nodes"""
    # Setup
    workflow = StateGraph(State)

    for i in range(node_count):
        workflow.add_node(f"node_{i}", simple_node)

    for i in range(node_count - 1):
        workflow.add_edge(f"node_{i}", f"node_{i+1}")

    workflow.add_edge(f"node_{node_count-1}", END)
    workflow.set_entry_point("node_0")

    app = workflow.compile()

    times = []

    for _ in range(iterations):
        start = time.perf_counter()
        result = app.invoke({"messages": [], "count": 0})
        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to ms

    return {
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "min": min(times),
        "max": max(times),
        "stdev": statistics.stdev(times) if len(times) > 1 else 0
    }


def benchmark_state_operations(iterations=10000):
    """Benchmark state operations"""
    times = {
        "creation": [],
        "set": [],
        "get": []
    }

    # State creation
    for _ in range(iterations):
        start = time.perf_counter()
        state = {"messages": [], "count": 0}
        end = time.perf_counter()
        times["creation"].append((end - start) * 1000000)  # μs

    # State set
    state = {"messages": [], "count": 0}
    for i in range(iterations):
        start = time.perf_counter()
        state["count"] = i
        end = time.perf_counter()
        times["set"].append((end - start) * 1000000)  # μs

    # State get
    for _ in range(iterations):
        start = time.perf_counter()
        _ = state.get("count")
        end = time.perf_counter()
        times["get"].append((end - start) * 1000000)  # μs

    return {
        "creation": {
            "mean": statistics.mean(times["creation"]),
            "median": statistics.median(times["creation"]),
        },
        "set": {
            "mean": statistics.mean(times["set"]),
            "median": statistics.median(times["set"]),
        },
        "get": {
            "mean": statistics.mean(times["get"]),
            "median": statistics.median(times["get"]),
        }
    }


def run_all_benchmarks():
    """Run all benchmarks and print results"""
    print("=" * 70)
    print("Python LangGraph Benchmark Results")
    print("=" * 70)

    print("\n1. Graph Compilation (100 iterations)")
    print("-" * 70)
    results = benchmark_graph_compilation()
    print(f"  Mean:   {results['mean']:.3f} ms")
    print(f"  Median: {results['median']:.3f} ms")
    print(f"  Min:    {results['min']:.3f} ms")
    print(f"  Max:    {results['max']:.3f} ms")
    print(f"  StdDev: {results['stdev']:.3f} ms")

    print("\n2. Single Node Execution (100 iterations)")
    print("-" * 70)
    results = benchmark_single_node_execution()
    print(f"  Mean:   {results['mean']:.3f} μs")
    print(f"  Median: {results['median']:.3f} μs")
    print(f"  Min:    {results['min']:.3f} μs")
    print(f"  Max:    {results['max']:.3f} μs")
    print(f"  StdDev: {results['stdev']:.3f} μs")

    print("\n3. Multi-Node Execution")
    print("-" * 70)
    for node_count in [2, 5, 10, 20]:
        results = benchmark_multi_node_execution(node_count)
        print(f"  {node_count} nodes:")
        print(f"    Mean:   {results['mean']:.3f} ms")
        print(f"    Median: {results['median']:.3f} ms")

    print("\n4. State Operations (10000 iterations)")
    print("-" * 70)
    results = benchmark_state_operations()
    print(f"  Creation - Mean: {results['creation']['mean']:.3f} μs, "
          f"Median: {results['creation']['median']:.3f} μs")
    print(f"  Set      - Mean: {results['set']['mean']:.3f} μs, "
          f"Median: {results['set']['median']:.3f} μs")
    print(f"  Get      - Mean: {results['get']['mean']:.3f} μs, "
          f"Median: {results['get']['median']:.3f} μs")

    print("\n" + "=" * 70)
    print("Benchmark Complete")
    print("=" * 70)


if __name__ == "__main__":
    run_all_benchmarks()
