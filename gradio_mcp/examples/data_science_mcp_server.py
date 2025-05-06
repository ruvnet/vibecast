"""
Data Science MCP Server implementation.
This module provides a Gradio interface with MCP tools for data science tasks.
"""

import os
import sys
import base64
import argparse
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import gradio as gr
from io import BytesIO, StringIO
from typing import Dict, Any, List, Optional, Union
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import MCP server
from gradio_mcp.server import MCPServer

# Configure matplotlib to use Agg backend
plt.switch_backend('Agg')

# Helper function to convert CSV string to DataFrame
def csv_to_df(csv_data: str) -> pd.DataFrame:
    """Convert CSV string to DataFrame."""
    try:
        return pd.read_csv(StringIO(csv_data))
    except Exception as e:
        return pd.DataFrame({"error": [str(e)]})

# Helper function to convert plot to base64 string
def plot_to_base64(fig) -> str:
    """Convert matplotlib figure to base64 string."""
    try:
        buf = BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        buf.close()
        plt.close(fig)
        return img_str
    except Exception as e:
        return {"error": str(e)}

# Data Analysis Tools
def describe_dataframe(csv_data: str) -> Dict[str, Any]:
    """
    Generate descriptive statistics for a DataFrame.
    
    Args:
        csv_data (str): CSV data as a string
        
    Returns:
        Dict[str, Any]: Descriptive statistics
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Generate descriptive statistics
    stats = {}
    stats["shape"] = {"rows": df.shape[0], "columns": df.shape[1]}
    stats["columns"] = list(df.columns)
    stats["dtypes"] = {col: str(df[col].dtype) for col in df.columns}
    stats["missing_values"] = {col: int(df[col].isna().sum()) for col in df.columns}
    stats["numeric_summary"] = df.describe().to_dict()
    
    return stats

def correlation_matrix(csv_data: str) -> Dict[str, Any]:
    """
    Calculate correlation matrix for numeric columns in a DataFrame.
    
    Args:
        csv_data (str): CSV data as a string
        
    Returns:
        Dict[str, Any]: Correlation matrix
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Select only numeric columns
    numeric_df = df.select_dtypes(include=['number'])
    if numeric_df.empty:
        return {"error": "No numeric columns found in the data"}
    
    # Calculate correlation matrix
    corr_matrix = numeric_df.corr().to_dict()
    
    return corr_matrix

# Data Visualization Tools
def generate_scatter_plot(csv_data: str, x_column: str, y_column: str, color_column: Optional[str] = None) -> str:
    """
    Generate a scatter plot from DataFrame columns.
    
    Args:
        csv_data (str): CSV data as a string
        x_column (str): Column name for x-axis
        y_column (str): Column name for y-axis
        color_column (Optional[str], optional): Column name for color. Defaults to None.
        
    Returns:
        str: Base64 encoded image
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Check if columns exist
    for col in [x_column, y_column]:
        if col not in df.columns:
            return {"error": f"Column '{col}' not found in the data"}
    
    if color_column and color_column not in df.columns:
        return {"error": f"Column '{color_column}' not found in the data"}
    
    # Create scatter plot
    fig, ax = plt.subplots(figsize=(10, 6))
    
    if color_column:
        scatter = ax.scatter(df[x_column], df[y_column], c=df[color_column], cmap='viridis', alpha=0.7)
        plt.colorbar(scatter, ax=ax, label=color_column)
    else:
        ax.scatter(df[x_column], df[y_column], alpha=0.7)
    
    ax.set_xlabel(x_column)
    ax.set_ylabel(y_column)
    ax.set_title(f'Scatter Plot: {y_column} vs {x_column}')
    ax.grid(True, linestyle='--', alpha=0.7)
    
    return plot_to_base64(fig)

def generate_histogram(csv_data: str, column: str, bins: int = 20) -> str:
    """
    Generate a histogram from a DataFrame column.
    
    Args:
        csv_data (str): CSV data as a string
        column (str): Column name for histogram
        bins (int, optional): Number of bins. Defaults to 20.
        
    Returns:
        str: Base64 encoded image
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Check if column exists
    if column not in df.columns:
        return {"error": f"Column '{column}' not found in the data"}
    
    # Create histogram
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.hist(df[column], bins=bins, alpha=0.7, color='skyblue', edgecolor='black')
    
    ax.set_xlabel(column)
    ax.set_ylabel('Frequency')
    ax.set_title(f'Histogram of {column}')
    ax.grid(True, linestyle='--', alpha=0.7)
    
    return plot_to_base64(fig)

# Machine Learning Tools
def linear_regression(csv_data: str, x_column: str, y_column: str) -> Dict[str, Any]:
    """
    Perform linear regression on DataFrame columns.
    
    Args:
        csv_data (str): CSV data as a string
        x_column (str): Column name for independent variable
        y_column (str): Column name for dependent variable
        
    Returns:
        Dict[str, Any]: Regression results and plot
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Check if columns exist
    for col in [x_column, y_column]:
        if col not in df.columns:
            return {"error": f"Column '{col}' not found in the data"}
    
    # Prepare data
    X = df[x_column].values.reshape(-1, 1)
    y = df[y_column].values
    
    # Fit linear regression model
    model = LinearRegression()
    model.fit(X, y)
    
    # Make predictions
    y_pred = model.predict(X)
    
    # Calculate metrics
    mse = np.mean((y - y_pred) ** 2)
    r_squared = model.score(X, y)
    
    # Create plot
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.scatter(X, y, alpha=0.7, label='Data')
    ax.plot(X, y_pred, color='red', linewidth=2, label='Regression Line')
    
    ax.set_xlabel(x_column)
    ax.set_ylabel(y_column)
    ax.set_title(f'Linear Regression: {y_column} vs {x_column}')
    ax.grid(True, linestyle='--', alpha=0.7)
    ax.legend()
    
    # Return results
    results = {
        "coefficient": float(model.coef_[0]),
        "intercept": float(model.intercept_),
        "r_squared": r_squared,
        "mse": mse,
        "plot": plot_to_base64(fig)
    }
    
    return results

def kmeans_clustering(csv_data: str, x_column: str, y_column: str, n_clusters: int = 3) -> Dict[str, Any]:
    """
    Perform K-means clustering on DataFrame columns.
    
    Args:
        csv_data (str): CSV data as a string
        x_column (str): Column name for x-axis
        y_column (str): Column name for y-axis
        n_clusters (int, optional): Number of clusters. Defaults to 3.
        
    Returns:
        Dict[str, Any]: Clustering results and plot
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Check if columns exist
    for col in [x_column, y_column]:
        if col not in df.columns:
            return {"error": f"Column '{col}' not found in the data"}
    
    # Prepare data
    X = df[[x_column, y_column]].values
    
    # Fit K-means model
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    clusters = kmeans.fit_predict(X)
    
    # Add cluster labels to DataFrame
    df_with_clusters = df.copy()
    df_with_clusters['cluster'] = clusters
    
    # Create plot
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Plot each cluster
    for i in range(n_clusters):
        cluster_points = df_with_clusters[df_with_clusters['cluster'] == i]
        ax.scatter(cluster_points[x_column], cluster_points[y_column], label=f'Cluster {i}', alpha=0.7)
    
    # Plot cluster centers
    ax.scatter(kmeans.cluster_centers_[:, 0], kmeans.cluster_centers_[:, 1], 
               s=200, marker='X', c='red', label='Centroids')
    
    ax.set_xlabel(x_column)
    ax.set_ylabel(y_column)
    ax.set_title(f'K-means Clustering (k={n_clusters})')
    ax.grid(True, linestyle='--', alpha=0.7)
    ax.legend()
    
    # Return results
    results = {
        "n_clusters": n_clusters,
        "cluster_centers": kmeans.cluster_centers_.tolist(),
        "cluster_counts": {f"cluster_{i}": int((clusters == i).sum()) for i in range(n_clusters)},
        "plot": plot_to_base64(fig)
    }
    
    return results

def pca_analysis(csv_data: str, n_components: int = 2) -> Dict[str, Any]:
    """
    Perform PCA on DataFrame.
    
    Args:
        csv_data (str): CSV data as a string
        n_components (int, optional): Number of components. Defaults to 2.
        
    Returns:
        Dict[str, Any]: PCA results and plot
    """
    df = csv_to_df(csv_data)
    if "error" in df.columns:
        return {"error": df["error"][0]}
    
    # Select only numeric columns
    numeric_df = df.select_dtypes(include=['number'])
    if numeric_df.empty:
        return {"error": "No numeric columns found in the data"}
    
    # Standardize the data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(numeric_df)
    
    # Fit PCA model
    pca = PCA(n_components=n_components)
    X_pca = pca.fit_transform(X_scaled)
    
    # Create plot (only for 2 components)
    if n_components >= 2:
        fig, ax = plt.subplots(figsize=(10, 6))
        
        ax.scatter(X_pca[:, 0], X_pca[:, 1], alpha=0.7)
        
        ax.set_xlabel('Principal Component 1')
        ax.set_ylabel('Principal Component 2')
        ax.set_title('PCA: First Two Principal Components')
        ax.grid(True, linestyle='--', alpha=0.7)
        
        plot_img = plot_to_base64(fig)
    else:
        plot_img = None
    
    # Return results
    results = {
        "n_components": n_components,
        "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
        "total_explained_variance": float(sum(pca.explained_variance_ratio_)),
        "feature_importance": {col: float(abs(val)) for col, val in zip(numeric_df.columns, pca.components_[0])},
        "plot": plot_img
    }
    
    return results

# Create Gradio interface
with gr.Blocks() as demo:
    gr.Markdown("# Data Science MCP Server")
    
    # Create MCP server
    mcp_server = MCPServer()
    
    # Register data analysis tools
    mcp_server.register_tool(
        name="describe_dataframe",
        fn=describe_dataframe,
        description="Generate descriptive statistics for a DataFrame",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            }
        }
    )
    
    mcp_server.register_tool(
        name="correlation_matrix",
        fn=correlation_matrix,
        description="Calculate correlation matrix for numeric columns in a DataFrame",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            }
        }
    )
    
    # Register data visualization tools
    mcp_server.register_tool(
        name="generate_scatter_plot",
        fn=generate_scatter_plot,
        description="Generate a scatter plot from DataFrame columns",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            },
            "x_column": {
                "type": "string",
                "description": "Column name for x-axis"
            },
            "y_column": {
                "type": "string",
                "description": "Column name for y-axis"
            },
            "color_column": {
                "type": "string",
                "description": "Column name for color (optional)",
                "optional": True
            }
        }
    )
    
    mcp_server.register_tool(
        name="generate_histogram",
        fn=generate_histogram,
        description="Generate a histogram from a DataFrame column",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            },
            "column": {
                "type": "string",
                "description": "Column name for histogram"
            },
            "bins": {
                "type": "integer",
                "description": "Number of bins (optional)",
                "default": 20,
                "optional": True
            }
        }
    )
    
    # Register machine learning tools
    mcp_server.register_tool(
        name="linear_regression",
        fn=linear_regression,
        description="Perform linear regression on DataFrame columns",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            },
            "x_column": {
                "type": "string",
                "description": "Column name for independent variable"
            },
            "y_column": {
                "type": "string",
                "description": "Column name for dependent variable"
            }
        }
    )
    
    mcp_server.register_tool(
        name="kmeans_clustering",
        fn=kmeans_clustering,
        description="Perform K-means clustering on DataFrame columns",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            },
            "x_column": {
                "type": "string",
                "description": "Column name for x-axis"
            },
            "y_column": {
                "type": "string",
                "description": "Column name for y-axis"
            },
            "n_clusters": {
                "type": "integer",
                "description": "Number of clusters (optional)",
                "default": 3,
                "optional": True
            }
        }
    )
    
    mcp_server.register_tool(
        name="pca_analysis",
        fn=pca_analysis,
        description="Perform PCA on DataFrame",
        parameters={
            "csv_data": {
                "type": "string",
                "description": "CSV data as a string"
            },
            "n_components": {
                "type": "integer",
                "description": "Number of components (optional)",
                "default": 2,
                "optional": True
            }
        }
    )

# Parse command line arguments
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the data science MCP server")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument("--share", action="store_true", help="Enable sharing")
    parser.add_argument("--port", type=int, default=7860, help="Port to run the server on")
    
    args = parser.parse_args()
    
    # Launch the demo
    demo.queue().launch(
        debug=args.debug,
        share=args.share,
        server_port=args.port,
        server_name="0.0.0.0"
    )