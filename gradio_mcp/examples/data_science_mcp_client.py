"""
Example client for the data science MCP server.
"""

import os
import sys
import gradio as gr
import pandas as pd
import numpy as np
import base64
from io import BytesIO
from PIL import Image

# Add the parent directory to the path so we can import the package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from gradio_mcp.client import Client

# Create a client connected to the data science MCP server
client = Client({"server_url": "http://localhost:7866"})

def display_image(base64_str):
    """Display an image from a base64 string."""
    try:
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        return img
    except Exception as e:
        return None

def generate_example_data():
    """Generate example data for demonstration."""
    # Generate a simple dataset
    np.random.seed(42)
    n = 100
    x = np.random.normal(0, 1, n)
    y = 2 * x + 1 + np.random.normal(0, 1, n)
    
    # Create a DataFrame
    df = pd.DataFrame({
        'x': x,
        'y': y,
        'category': np.random.choice(['A', 'B', 'C'], n)
    })
    
    return df.to_csv(index=False)

# Create Gradio interface
with gr.Blocks(title="Data Science MCP Client") as demo:
    gr.Markdown("# Data Science MCP Client")
    
    with gr.Tab("Data Analysis"):
        with gr.Row():
            with gr.Column():
                csv_input = gr.Textbox(
                    label="CSV Data",
                    placeholder="Enter CSV data or use the example data",
                    lines=10
                )
                example_btn = gr.Button("Load Example Data")
                
                def load_example_data():
                    return generate_example_data()
                
                example_btn.click(fn=load_example_data, outputs=csv_input)
                
                analyze_btn = gr.Button("Analyze Data")
            
            with gr.Column():
                stats_output = gr.JSON(label="Statistics")
        
        def analyze_data(csv_data):
            try:
                result = client.execute_tool("describe_dataframe", {"csv_data": csv_data})
                return result
            except Exception as e:
                return {"error": str(e)}
        
        analyze_btn.click(fn=analyze_data, inputs=csv_input, outputs=stats_output)
    
    with gr.Tab("Visualization"):
        with gr.Row():
            with gr.Column():
                csv_input_viz = gr.Textbox(
                    label="CSV Data",
                    placeholder="Enter CSV data or use the example data",
                    lines=10
                )
                example_btn_viz = gr.Button("Load Example Data")
                example_btn_viz.click(fn=load_example_data, outputs=csv_input_viz)
                
                x_column = gr.Textbox(label="X Column", value="x")
                y_column = gr.Textbox(label="Y Column", value="y")
                color_column = gr.Textbox(label="Color Column (optional)", value="category")
                
                scatter_btn = gr.Button("Generate Scatter Plot")
                histogram_btn = gr.Button("Generate Histogram")
            
            with gr.Column():
                plot_output = gr.Image(label="Plot")
        
        def generate_scatter(csv_data, x_col, y_col, color_col):
            try:
                params = {
                    "csv_data": csv_data,
                    "x_column": x_col,
                    "y_column": y_col
                }
                
                if color_col:
                    params["color_column"] = color_col
                
                result = client.execute_tool("generate_scatter_plot", params)
                return display_image(result)
            except Exception as e:
                return None
        
        def generate_histogram(csv_data, x_col):
            try:
                result = client.execute_tool("generate_histogram", {
                    "csv_data": csv_data,
                    "column": x_col,
                    "bins": 20
                })
                return display_image(result)
            except Exception as e:
                return None
        
        scatter_btn.click(
            fn=generate_scatter,
            inputs=[csv_input_viz, x_column, y_column, color_column],
            outputs=plot_output
        )
        
        histogram_btn.click(
            fn=generate_histogram,
            inputs=[csv_input_viz, x_column],
            outputs=plot_output
        )
    
    with gr.Tab("Machine Learning"):
        with gr.Row():
            with gr.Column():
                csv_input_ml = gr.Textbox(
                    label="CSV Data",
                    placeholder="Enter CSV data or use the example data",
                    lines=10
                )
                example_btn_ml = gr.Button("Load Example Data")
                example_btn_ml.click(fn=load_example_data, outputs=csv_input_ml)
                
                x_column_ml = gr.Textbox(label="X Column", value="x")
                y_column_ml = gr.Textbox(label="Y Column", value="y")
                
                regression_btn = gr.Button("Linear Regression")
                clustering_btn = gr.Button("K-means Clustering")
                pca_btn = gr.Button("PCA Analysis")
            
            with gr.Column():
                ml_output = gr.JSON(label="Results")
                ml_plot = gr.Image(label="Plot")
        
        def run_regression(csv_data, x_col, y_col):
            try:
                result = client.execute_tool("linear_regression", {
                    "csv_data": csv_data,
                    "x_column": x_col,
                    "y_column": y_col
                })
                
                # Extract plot
                plot_img = display_image(result.pop("plot", ""))
                
                return result, plot_img
            except Exception as e:
                return {"error": str(e)}, None
        
        def run_clustering(csv_data, x_col, y_col):
            try:
                result = client.execute_tool("kmeans_clustering", {
                    "csv_data": csv_data,
                    "x_column": x_col,
                    "y_column": y_col,
                    "n_clusters": 3
                })
                
                # Extract plot
                plot_img = display_image(result.pop("plot", ""))
                
                return result, plot_img
            except Exception as e:
                return {"error": str(e)}, None
        
        def run_pca(csv_data):
            try:
                result = client.execute_tool("pca_analysis", {
                    "csv_data": csv_data,
                    "n_components": 2
                })
                
                # Extract plot
                plot_img = display_image(result.pop("plot", ""))
                
                return result, plot_img
            except Exception as e:
                return {"error": str(e)}, None
        
        regression_btn.click(
            fn=run_regression,
            inputs=[csv_input_ml, x_column_ml, y_column_ml],
            outputs=[ml_output, ml_plot]
        )
        
        clustering_btn.click(
            fn=run_clustering,
            inputs=[csv_input_ml, x_column_ml, y_column_ml],
            outputs=[ml_output, ml_plot]
        )
        
        pca_btn.click(
            fn=run_pca,
            inputs=[csv_input_ml],
            outputs=[ml_output, ml_plot]
        )

# Launch the demo
if __name__ == "__main__":
    demo.launch()