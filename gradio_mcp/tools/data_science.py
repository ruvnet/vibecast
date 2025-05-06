"""
Data Science tools for the Gradio MCP implementation.
This module provides data analysis, visualization, and machine learning tools.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from typing import Dict, List, Union, Optional, Tuple, Any
import json
import base64
from io import BytesIO

def describe_dataframe(csv_data: str) -> Dict[str, Any]:
    """
    Generate statistical summary of a CSV dataset.
    
    Args:
        csv_data (str): CSV data as a string
        
    Returns:
        dict: Statistical summary including mean, median, std, min, max for each column
    """
    # Convert string to DataFrame
    df = pd.read_csv(BytesIO(csv_data.encode()))
    
    # Generate summary statistics
    summary = {
        "shape": df.shape,
        "columns": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "missing_values": df.isnull().sum().to_dict(),
        "numeric_summary": {}
    }
    
    # Add numeric summaries for numeric columns
    numeric_cols = df.select_dtypes(include=['number']).columns
    for col in numeric_cols:
        summary["numeric_summary"][col] = {
            "mean": float(df[col].mean()),
            "median": float(df[col].median()),
            "std": float(df[col].std()),
            "min": float(df[col].min()),
            "max": float(df[col].max())
        }
    
    return summary

def correlation_matrix(csv_data: str) -> Dict[str, Any]:
    """
    Calculate correlation matrix for numeric columns in a dataset.
    
    Args:
        csv_data (str): CSV data as a string
        
    Returns:
        dict: Correlation matrix as a nested dictionary
    """
    # Convert string to DataFrame
    df = pd.read_csv(BytesIO(csv_data.encode()))
    
    # Select numeric columns
    numeric_df = df.select_dtypes(include=['number'])
    
    # Calculate correlation matrix
    corr_matrix = numeric_df.corr().round(3)
    
    # Convert to dictionary
    result = {
        "columns": numeric_df.columns.tolist(),
        "correlation_matrix": corr_matrix.to_dict(orient='index')
    }
    
    return result

def generate_histogram(csv_data: str, column: str, bins: int = 10) -> str:
    """
    Generate a histogram for a specific column in the dataset.
    
    Args:
        csv_data (str): CSV data as a string
        column (str): Column name to plot
        bins (int, optional): Number of bins for histogram. Defaults to 10.
        
    Returns:
        str: Base64 encoded PNG image of the histogram
    """
    # Convert string to DataFrame
    df = pd.read_csv(BytesIO(csv_data.encode()))
    
    # Check if column exists
    if column not in df.columns:
        return json.dumps({"error": f"Column '{column}' not found in dataset"})
    
    # Check if column is numeric
    if not np.issubdtype(df[column].dtype, np.number):
        return json.dumps({"error": f"Column '{column}' is not numeric"})
    
    # Create histogram
    plt.figure(figsize=(10, 6))
    plt.hist(df[column].dropna(), bins=bins)
    plt.title(f'Histogram of {column}')
    plt.xlabel(column)
    plt.ylabel('Frequency')
    plt.grid(True, alpha=0.3)
    
    # Convert plot to base64 encoded string
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    image_png = buffer.getvalue()
    buffer.close()
    plt.close()
    
    # Encode the PNG image to base64 string
    encoded = base64.b64encode(image_png).decode('utf-8')
    
    return encoded

def generate_scatter_plot(csv_data: str, x_column: str, y_column: str, color_column: Optional[str] = None) -> str:
    """
    Generate a scatter plot for two columns in the dataset.
    
    Args:
        csv_data (str): CSV data as a string
        x_column (str): Column name for x-axis
        y_column (str): Column name for y-axis
        color_column (str, optional): Column name for color coding points. Defaults to None.
        
    Returns:
        str: Base64 encoded PNG image of the scatter plot
    """
    # Convert string to DataFrame
    df = pd.read_csv(BytesIO(csv_data.encode()))
    
    # Check if columns exist
    for col in [x_column, y_column]:
        if col not in df.columns:
            return json.dumps({"error": f"Column '{col}' not found in dataset"})
    
    if color_column and color_column not in df.columns:
        return json.dumps({"error": f"Column '{color_column}' not found in dataset"})
    
    # Check if columns are numeric
    for col in [x_column, y_column]:
        if not np.issubdtype(df[col].dtype, np.number):
            return json.dumps({"error": f"Column '{col}' is not numeric"})
    
    # Create scatter plot
    plt.figure(figsize=(10, 6))
    
    if color_column:
        scatter = plt.scatter(df[x_column], df[y_column], c=df[color_column] if np.issubdtype(df[color_column].dtype, np.number) else None, 
                             alpha=0.6)
        if np.issubdtype(df[color_column].dtype, np.number):
            plt.colorbar(scatter, label=color_column)
    else:
        plt.scatter(df[x_column], df[y_column], alpha=0.6)
    
    plt.title(f'Scatter Plot: {y_column} vs {x_column}')
    plt.xlabel(x_column)
    plt.ylabel(y_column)
    plt.grid(True, alpha=0.3)
    
    # Convert plot to base64 encoded string
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    image_png = buffer.getvalue()
    buffer.close()
    plt.close()
    
    # Encode the PNG image to base64 string
    encoded = base64.b64encode(image_png).decode('utf-8')
    
    return encoded

def linear_regression(csv_data: str, x_column: str, y_column: str) -> Dict[str, Any]:
    """
    Perform simple linear regression between two columns.
    
    Args:
        csv_data (str): CSV data as a string
        x_column (str): Independent variable column name
        y_column (str): Dependent variable column name
        
    Returns:
        dict: Regression results including slope, intercept, r-squared
    """
    try:
        # Convert string to DataFrame
        df = pd.read_csv(BytesIO(csv_data.encode()))
        
        # Check if columns exist
        for col in [x_column, y_column]:
            if col not in df.columns:
                return {"error": f"Column '{col}' not found in dataset"}
        
        # Check if columns are numeric
        for col in [x_column, y_column]:
            if not np.issubdtype(df[col].dtype, np.number):
                return {"error": f"Column '{col}' is not numeric"}
        
        # Drop rows with missing values
        data = df[[x_column, y_column]].dropna()
        
        # Perform linear regression
        x = data[x_column].values
        y = data[y_column].values
        
        # Calculate regression parameters
        n = len(x)
        if n < 2:
            return {"error": "Not enough data points for regression"}
        
        slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x**2) - np.sum(x)**2)
        intercept = (np.sum(y) - slope * np.sum(x)) / n
        
        # Calculate r-squared
        y_pred = slope * x + intercept
        ss_total = np.sum((y - np.mean(y))**2)
        ss_residual = np.sum((y - y_pred)**2)
        r_squared = 1 - (ss_residual / ss_total)
        
        # Generate plot
        plt.figure(figsize=(10, 6))
        plt.scatter(x, y, alpha=0.6)
        plt.plot(x, y_pred, color='red', linewidth=2)
        plt.title(f'Linear Regression: {y_column} vs {x_column}')
        plt.xlabel(x_column)
        plt.ylabel(y_column)
        plt.grid(True, alpha=0.3)
        
        # Convert plot to base64 encoded string
        buffer = BytesIO()
        plt.savefig(buffer, format='png')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()
        
        # Encode the PNG image to base64 string
        plot_encoded = base64.b64encode(image_png).decode('utf-8')
        
        return {
            "slope": float(slope),
            "intercept": float(intercept),
            "r_squared": float(r_squared),
            "equation": f"y = {slope:.4f}x + {intercept:.4f}",
            "plot": plot_encoded
        }
    
    except Exception as e:
        return {"error": str(e)}

def kmeans_clustering(csv_data: str, x_column: str, y_column: str, n_clusters: int = 3) -> Dict[str, Any]:
    """
    Perform K-means clustering on two columns of data.
    
    Args:
        csv_data (str): CSV data as a string
        x_column (str): First column for clustering
        y_column (str): Second column for clustering
        n_clusters (int, optional): Number of clusters. Defaults to 3.
        
    Returns:
        dict: Clustering results including cluster centers and plot
    """
    try:
        # Import here to avoid dependency issues
        from sklearn.cluster import KMeans
        
        # Convert string to DataFrame
        df = pd.read_csv(BytesIO(csv_data.encode()))
        
        # Check if columns exist
        for col in [x_column, y_column]:
            if col not in df.columns:
                return {"error": f"Column '{col}' not found in dataset"}
        
        # Check if columns are numeric
        for col in [x_column, y_column]:
            if not np.issubdtype(df[col].dtype, np.number):
                return {"error": f"Column '{col}' is not numeric"}
        
        # Drop rows with missing values
        data = df[[x_column, y_column]].dropna()
        
        # Perform K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        data['cluster'] = kmeans.fit_predict(data[[x_column, y_column]])
        
        # Get cluster centers
        centers = kmeans.cluster_centers_
        
        # Generate plot
        plt.figure(figsize=(10, 6))
        plt.scatter(data[x_column], data[y_column], c=data['cluster'], cmap='viridis', alpha=0.6)
        plt.scatter(centers[:, 0], centers[:, 1], c='red', marker='X', s=200, alpha=0.8)
        plt.title(f'K-means Clustering ({n_clusters} clusters)')
        plt.xlabel(x_column)
        plt.ylabel(y_column)
        plt.grid(True, alpha=0.3)
        
        # Convert plot to base64 encoded string
        buffer = BytesIO()
        plt.savefig(buffer, format='png')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()
        
        # Encode the PNG image to base64 string
        plot_encoded = base64.b64encode(image_png).decode('utf-8')
        
        return {
            "n_clusters": n_clusters,
            "cluster_centers": centers.tolist(),
            "cluster_counts": data['cluster'].value_counts().to_dict(),
            "plot": plot_encoded
        }
    
    except ImportError:
        return {"error": "scikit-learn is not installed. Please install it with 'pip install scikit-learn'"}
    except Exception as e:
        return {"error": str(e)}

def pca_analysis(csv_data: str, n_components: int = 2) -> Dict[str, Any]:
    """
    Perform Principal Component Analysis (PCA) on numeric columns.
    
    Args:
        csv_data (str): CSV data as a string
        n_components (int, optional): Number of principal components. Defaults to 2.
        
    Returns:
        dict: PCA results including explained variance and plot
    """
    try:
        # Import here to avoid dependency issues
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler
        
        # Convert string to DataFrame
        df = pd.read_csv(BytesIO(csv_data.encode()))
        
        # Select numeric columns
        numeric_df = df.select_dtypes(include=['number'])
        
        if numeric_df.shape[1] < 2:
            return {"error": "Need at least 2 numeric columns for PCA"}
        
        # Drop rows with missing values
        numeric_df = numeric_df.dropna()
        
        if numeric_df.shape[0] < 2:
            return {"error": "Not enough data points for PCA after removing missing values"}
        
        # Standardize the data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numeric_df)
        
        # Perform PCA
        pca = PCA(n_components=min(n_components, numeric_df.shape[1]))
        principal_components = pca.fit_transform(scaled_data)
        
        # Create DataFrame with principal components
        pca_df = pd.DataFrame(
            data=principal_components,
            columns=[f'PC{i+1}' for i in range(principal_components.shape[1])]
        )
        
        # Generate plot (first two components)
        plt.figure(figsize=(10, 6))
        plt.scatter(pca_df['PC1'], pca_df['PC2'] if 'PC2' in pca_df.columns else np.zeros(pca_df.shape[0]), alpha=0.6)
        plt.title('PCA: First Two Principal Components')
        plt.xlabel('PC1')
        plt.ylabel('PC2' if 'PC2' in pca_df.columns else '')
        plt.grid(True, alpha=0.3)
        
        # Convert plot to base64 encoded string
        buffer = BytesIO()
        plt.savefig(buffer, format='png')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()
        
        # Encode the PNG image to base64 string
        plot_encoded = base64.b64encode(image_png).decode('utf-8')
        
        return {
            "n_components": pca.n_components_,
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "cumulative_explained_variance": np.cumsum(pca.explained_variance_ratio_).tolist(),
            "feature_importance": {
                numeric_df.columns[i]: [float(pca.components_[j, i]) for j in range(pca.n_components_)]
                for i in range(numeric_df.shape[1])
            },
            "plot": plot_encoded
        }
    
    except ImportError:
        return {"error": "scikit-learn is not installed. Please install it with 'pip install scikit-learn'"}
    except Exception as e:
        return {"error": str(e)}