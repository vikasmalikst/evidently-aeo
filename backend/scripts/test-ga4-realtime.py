"""
GA4 Real-Time Report Test Script
Tests GA4 real-time reports with property ID 516904207
"""

import os
import json
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunRealtimeReportRequest,
    Dimension,
    Metric
)

# Configuration
PROPERTY_ID = '516904207'
JSON_FILE_PATH = r'C:\Users\rakit\Downloads\startup-444304-9384d2116ae1.json'

# Set up credentials
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = JSON_FILE_PATH

# Dimensions and metrics
lst_dimension = ['country', 'deviceCategory']
lst_metrics = ['activeUsers']

def query_realtime_report(property_id, dimensions, metrics, row_limit=10, quota_usage=False):
    """
    Query GA4 real-time report
    
    :param property_id: GA4 property ID
    :param dimensions: List of dimension names (e.g., ['country', 'city'])
    :param metrics: List of metric names (e.g., ['activeUsers'])
    :param row_limit: Maximum number of rows to return
    :param quota_usage: Whether to return quota usage information
    :return: Dictionary with headers, rows, totals, and quota info
    """
    # Initialize client
    client = BetaAnalyticsDataClient()
    
    # Build dimension and metric objects
    dimension_list = [Dimension(name=dim) for dim in dimensions]
    metrics_list = [Metric(name=met) for met in metrics]
    
    # Create request
    request = RunRealtimeReportRequest(
        property=f'properties/{property_id}',
        dimensions=dimension_list,
        metrics=metrics_list,
        limit=row_limit,
        return_property_quota=quota_usage
    )
    
    # Execute request
    response = client.run_realtime_report(request)
    
    # Build output dictionary
    output = {}
    
    # Add quota information if requested
    if hasattr(response, 'property_quota') and response.property_quota:
        output['quota'] = {
            'tokens_per_day': response.property_quota.tokens_per_day if hasattr(response.property_quota, 'tokens_per_day') else None,
            'tokens_per_hour': response.property_quota.tokens_per_hour if hasattr(response.property_quota, 'tokens_per_hour') else None,
            'concurrent_requests': response.property_quota.concurrent_requests if hasattr(response.property_quota, 'concurrent_requests') else None,
        }
    
    # Extract headers
    dimension_headers = [header.name for header in response.dimension_headers] if response.dimension_headers else []
    metric_headers = [header.name for header in response.metric_headers] if response.metric_headers else []
    headers = dimension_headers + metric_headers
    output['headers'] = headers
    
    # Extract rows
    rows = []
    for row in response.rows:
        row_data = {
            'dimensions': [dv.value for dv in row.dimension_values] if row.dimension_values else [],
            'metrics': [mv.value for mv in row.metric_values] if row.metric_values else [],
        }
        # Also create a flat row for easier access
        row_data['flat'] = row_data['dimensions'] + row_data['metrics']
        rows.append(row_data)
    output['rows'] = rows
    
    # Extract totals
    totals = {}
    if response.totals and len(response.totals) > 0:
        for idx, metric_name in enumerate(metric_headers):
            if response.totals[0].metric_values and idx < len(response.totals[0].metric_values):
                totals[metric_name] = response.totals[0].metric_values[idx].value
    output['totals'] = totals
    
    # Row count
    output['row_count'] = response.row_count if hasattr(response, 'row_count') else len(rows)
    
    return output

def main():
    """Main function to test GA4 real-time reports"""
    print("Testing GA4 Real-Time Reports")
    print("=" * 80)
    print(f"Property ID: {PROPERTY_ID}")
    print(f"Dimensions: {', '.join(lst_dimension)}")
    print(f"Metrics: {', '.join(lst_metrics)}")
    print(f"JSON File: {JSON_FILE_PATH}")
    print("=" * 80)
    print()
    
    try:
        # Verify JSON file exists
        if not os.path.exists(JSON_FILE_PATH):
            print(f"ERROR: JSON file not found at {JSON_FILE_PATH}")
            return
        
        # Verify JSON is valid
        with open(JSON_FILE_PATH, 'r') as f:
            service_account = json.load(f)
            print(f"[OK] Service Account loaded:")
            print(f"     Project ID: {service_account.get('project_id', 'N/A')}")
            print(f"     Client Email: {service_account.get('client_email', 'N/A')}")
            print()
        
        # Query real-time report
        print("Querying real-time report...")
        print("-" * 80)
        
        response = query_realtime_report(
            property_id=PROPERTY_ID,
            dimensions=lst_dimension,
            metrics=lst_metrics,
            row_limit=10,
            quota_usage=True
        )
        
        print("[OK] Real-time report retrieved successfully!")
        print()
        
        # Display results
        print("Results:")
        print("-" * 80)
        
        # Headers
        headers = response['headers']
        print(f"Headers: {' | '.join(headers)}")
        print("-" * 80)
        
        # Rows
        rows = response['rows']
        if rows:
            print(f"\nFound {len(rows)} rows:\n")
            for idx, row in enumerate(rows, 1):
                values = row['flat']
                print(f"{idx:3d}: {' | '.join(values)}")
        else:
            print("\n[WARNING] No data returned (this is normal if there are no active users right now)")
        
        # Totals
        if response['totals']:
            print("\n" + "-" * 80)
            print("Totals:")
            for metric, value in response['totals'].items():
                print(f"  {metric}: {value}")
        
        # Row count
        print(f"\nTotal Rows: {response['row_count']}")
        
        # Quota information
        if 'quota' in response and response['quota']:
            print("\n" + "-" * 80)
            print("Quota Information:")
            quota = response['quota']
            if quota.get('tokens_per_day'):
                print(f"  Tokens per day remaining: {quota['tokens_per_day'].remaining}")
            if quota.get('tokens_per_hour'):
                print(f"  Tokens per hour remaining: {quota['tokens_per_hour'].remaining}")
            if quota.get('concurrent_requests'):
                print(f"  Concurrent requests remaining: {quota['concurrent_requests'].remaining}")
        
        print("\n[OK] Test completed successfully!")
        
    except Exception as e:
        print(f"\nERROR: {type(e).__name__}")
        print(f"       Message: {str(e)}")
        print()
        print("Possible issues:")
        print("  1. Install required package: pip install google-analytics-data")
        print("  2. Verify service account has 'Viewer' access in GA4 Property Settings")
        print("  3. Check that the property ID is correct")
        print("  4. Ensure the JSON file path is correct")

if __name__ == '__main__':
    main()

