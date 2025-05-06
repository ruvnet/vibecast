"""
Script to run the data science MCP client.
"""

import os
import sys
import argparse
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from io import BytesIO
import base64
from PIL import Image

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from gradio_mcp.client import Client

def display_image(base64_str):
    """Display an image from a base64 string."""
    try:
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        plt.figure(figsize=(10, 6))
        plt.imshow(np.array(img))
        plt.axis('off')
        plt.show()
    except Exception as e:
        print(f"Error displaying image: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description="Run the data science MCP client")
    parser.add_argument("--server-url", type=str, default="http://localhost:7866", help="URL of the MCP server")
    parser.add_argument("--example", type=str, default="iris", choices=["iris", "housing", "custom"], help="Example dataset to use")
    parser.add_argument("--csv-file", type=str, help="Path to a CSV file (for custom example)")
    
    args = parser.parse_args()
    
    # Create a client connected to the data science MCP server
    client = Client({"server_url": args.server_url})
    
    # Get the list of available tools
    tools = client.list_tools()
    print("Available tools:")
    for tool in tools:
        print(f"  - {tool}")
    
    # Generate example data
    if args.example == "iris":
        # Generate Iris dataset
        print("\nUsing Iris dataset example")
        from sklearn.datasets import load_iris
        iris = load_iris()
        df = pd.DataFrame(data=iris.data, columns=iris.feature_names)
        df['target'] = iris.target
        csv_data = df.to_csv(index=False)
        
        # Describe the dataset
        print("\nDescribing dataset:")
        result = client.execute_tool("describe_dataframe", {"csv_data": csv_data})
        print(f"Dataset shape: {result['shape']['rows']} rows, {result['shape']['columns']} columns")
        print(f"Columns: {result['columns']}")
        
        # Generate a scatter plot
        print("\nGenerating scatter plot:")
        result = client.execute_tool("generate_scatter_plot", {
            "csv_data": csv_data,
            "x_column": "sepal length (cm)",
            "y_column": "petal length (cm)",
            "color_column": "target"
        })
        
        # Display the plot
        display_image(result)
        
        # Perform K-means clustering
        print("\nPerforming K-means clustering:")
        result = client.execute_tool("kmeans_clustering", {
            "csv_data": csv_data,
            "x_column": "sepal length (cm)",
            "y_column": "petal length (cm)",
            "n_clusters": 3
        })
        
        print(f"Cluster centers: {result['cluster_centers']}")
        print(f"Cluster counts: {result['cluster_counts']}")
        
        # Display the plot
        display_image(result["plot"])
        
    elif args.example == "housing":
        # Generate California Housing dataset
        print("\nUsing California Housing dataset example")
        from sklearn.datasets import fetch_california_housing
        housing = fetch_california_housing()
        df = pd.DataFrame(data=housing.data, columns=housing.feature_names)
        df['target'] = housing.target
        csv_data = df.to_csv(index=False)
        
        # Describe the dataset
        print("\nDescribing dataset:")
        result = client.execute_tool("describe_dataframe", {"csv_data": csv_data})
        print(f"Dataset shape: {result['shape']['rows']} rows, {result['shape']['columns']} columns")
        print(f"Columns: {result['columns']}")
        
        # Generate a histogram
        print("\nGenerating histogram:")
        result = client.execute_tool("generate_histogram", {
            "csv_data": csv_data,
            "column": "MedInc",
            "bins": 30
        })
        
        # Display the plot
        display_image(result)
        
        # Perform linear regression
        print("\nPerforming linear regression:")
        result = client.execute_tool("linear_regression", {
            "csv_data": csv_data,
            "x_column": "MedInc",
            "y_column": "target"
        })
        
        print(f"Coefficient: {result['coefficient']}")
        print(f"Intercept: {result['intercept']}")
        print(f"R-squared: {result['r_squared']}")
        
        # Display the plot
        display_image(result["plot"])
        
    elif args.example == "custom":
        if not args.csv_file:
            print("Error: --csv-file is required for custom example")
            sys.exit(1)
        
        # Load custom dataset
        print(f"\nUsing custom dataset from {args.csv_file}")
        try:
            df = pd.read_csv(args.csv_file)
            csv_data = df.to_csv(index=False)
            
            # Describe the dataset
            print("\nDescribing dataset:")
            result = client.execute_tool("describe_dataframe", {"csv_data": csv_data})
            print(f"Dataset shape: {result['shape']['rows']} rows, {result['shape']['columns']} columns")
            print(f"Columns: {result['columns']}")
            
            # Get correlation matrix
            print("\nGenerating correlation matrix:")
            result = client.execute_tool("correlation_matrix", {"csv_data": csv_data})
            print(result)
            
            # Ask user for columns to plot
            numeric_columns = [col for col, dtype in result['dtypes'].items() if 'float' in dtype or 'int' in dtype]
            
            if len(numeric_columns) >= 2:
                x_column = numeric_columns[0]
                y_column = numeric_columns[1]
                
                # Generate a scatter plot
                print(f"\nGenerating scatter plot for {x_column} vs {y_column}:")
                result = client.execute_tool("generate_scatter_plot", {
                    "csv_data": csv_data,
                    "x_column": x_column,
                    "y_column": y_column
                })
                
                # Display the plot
                display_image(result)
                
                # Perform PCA analysis
                print("\nPerforming PCA analysis:")
                result = client.execute_tool("pca_analysis", {
                    "csv_data": csv_data,
                    "n_components": 2
                })
                
                print(f"Explained variance ratio: {result['explained_variance_ratio']}")
                print(f"Total explained variance: {result['total_explained_variance']}")
                
                # Display the plot
                display_image(result["plot"])
            else:
                print("Not enough numeric columns for scatter plot and PCA analysis")
                
        except Exception as e:
            print(f"Error processing custom dataset: {str(e)}")
    
    print("\nData science MCP client completed successfully")

if __name__ == "__main__":
    main()