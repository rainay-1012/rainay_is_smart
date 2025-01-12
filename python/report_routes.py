from database import Position
from flask import Blueprint, g, json, jsonify
from flask import current_app as app
from utils import check_token, openai_response, require_fields

report_routes = Blueprint("report_routes", __name__)

TABLES_METADATA = {
    "item": {
        "source": "/get_item_data",
        "description": "Represents an item in the system, associated with a category and procurement items.",
        "columns": {
            "name": {
                "type": "string",
                "description": "Name of the item.",
                "sample_data": ["Laptop", "Smartphone", "Chair"],
            },
            "last_update": {
                "type": "datetime",
                "description": "Timestamp of the last update to the item.",
                "sample_data": ["2023-10-01T12:34:56", "2023-10-02T14:20:10"],
            },
            "category": {
                "type": "string",
                "description": "The category associated with the item.",
                "sample_data": ["Electronics", "Furniture"],
            },
        },
        "relationship": {
            "category": {
                "description": "The category associated with the item. This is a relationship field and does not include sample data.",
            },
            "procurement_items": {
                "description": "List of procurement items associated with this item.",
            },
        },
    },
    "review": {
        "source": "Obtained by vendor source only.",
        "description": "Represents a review for a vendor, including the rating, caption, and date.",
        "columns": {
            "rating": {
                "type": "float",
                "description": "Rating given in the review, ranging from 0 to 5.",
                "sample_data": [4.5, 3.0, 5.0],
            },
            "caption": {
                "type": "string",
                "description": "Optional caption or comment provided in the review.",
                "sample_data": [
                    "Great service!",
                    "Could be better.",
                    "Highly recommended!",
                ],
            },
            "date": {
                "type": "datetime",
                "description": "Timestamp of when the review was created.",
                "sample_data": ["2023-10-01T12:34:56", "2023-10-02T14:20:10"],
            },
        },
        "relationship": {
            "vendor": {
                "type": "relationship",
                "description": "The vendor associated with the review.",
            },
        },
    },
    "vendor": {
        "source": "/get_vendor_data",
        "description": "Represents a vendor in the system, associated with categories, RFQs, and reviews.",
        "columns": {
            "name": {
                "type": "string",
                "description": "Name of the vendor.",
                "sample_data": ["Vendor A", "Vendor B"],
            },
            "approved": {
                "type": "boolean",
                "description": "Indicates whether the vendor is approved.",
                "sample_data": ["true", "false"],
            },
            "gred": {
                "type": "float",
                "description": "Rating score of the vendor, ranging from -1 (unrated) to 100.",
                "sample_data": [85.5, -1, 72.3],
            },
            "categories": {
                "type": "string[]",
                "description": "List of categories associated with the vendor.",
                "sample_data": [
                    ["Electronics", "Furniture"],
                    ["Entertainment", "Furniture"],
                ],
            },
            "reviews": {
                "type": "review[]",
                "description": "List of reviews associated with the vendor.",
                "sample_data": "Refer to review",
            },
        },
        "relationships": {
            "relationships": {
                "categories": {
                    "type": "category[]",
                    "description": "List of categories associated with the vendor.",
                    "sample_data": "Refer to category",
                },
                "rfqs": {
                    "type": "rfq[]",
                    "description": "List of RFQs (Requests for Quotation) associated with the vendor.",
                    "sample_data": "Refer to rfq",
                },
                "reviews": {
                    "type": "review[]",
                    "description": "List of reviews associated with the vendor.",
                    "sample_data": "Refer to review",
                },
            }
        },
    },
}

utils = [
    {
        "type": "utils:countBy",
        "description": "Groups and counts the occurrences of values in a specified field from the input data.",
        "config": {
            "source": {
                "type": "string",
                "description": "The field in the input data to group and count by.",
            }
        },
        "input": ["a", "b", "b"],
        "output": [{"a": 1, "b": 2}],
    },
    {
        "type": "utils:renameKeys",
        "description": "Renames the keys of objects in the input data based on a mapping provided in the configuration.",
        "config": {
            "map": {
                "type": "object",
                "description": "A key-value mapping where keys are the original keys and values are the new keys.",
            },
            "exception": {
                "type": "string",
                "description": "A default key to use if the original key is not found in the map.",
            },
        },
        "input": [{"oldKey1": "value1", "oldKey2": "value2"}],
        "output": [{"newKey1": "value1", "newKey2": "value2"}],
    },
    {
        "type": "utils:objectSplit",
        "description": "Splits an object into an array of objects, each containing a single key-value pair from the original object.",
        "config": {
            "index": {
                "type": "number",
                "description": "The index of the object in the input array to split. Defaults to 0 if not provided.",
            }
        },
        "input": [{"a": 1, "b": 2}],
        "output": [{"a": 1}, {"b": 2}],
    },
    {
        "type": "utils:flat",
        "description": "Flattens an array of objects into an array of key-value pairs, where each pair is represented as an object with `name` and `value` fields.",
        "config": {},
        "input": [{"a": 24}, {"b": 1}],
        "output": [{"name": "a", "value": 24}, {"name": "b", "value": 1}],
    },
    {
        "type": "utils:pick",
        "description": "Selects specific fields from objects in the input data based on the provided configuration.",
        "config": {
            "cols": {
                "type": "array",
                "description": "An array of field names to pick from the input objects.",
            }
        },
        "input": [{"a": 24, "b": 1, "c": 30}, {"a": 10, "b": 2, "c": 40}],
        "output": [{"a": 24, "b": 1}, {"a": 10, "b": 2}],
    },
]

system_content = f"""
You are an advanced data assistant designed to process structured data and generate visualizations using the Echarts library. Based on the provided metadata and user input, generate a comprehensive list of possible charts, including their titles and Echarts configuration options. Ensure the configurations are appropriately tailored to the data's format and content. If no charts can be generated due to the nature of the data, return an empty list.

### Rules:
1. **Dataset Field Only**:  
   - Apply custom utils (e.g., filter, sort, countBy) **ONLY** in the `dataset` field.  
   - **Do NOT** apply utils in `series.data` or any other field. 
   - Use **empty placeholders** (`"source": []`) in the dataset source. 

2. **Example Compliance**:  
   - Follow the provided example for utils application in the `dataset` field.  

3. **Mandatory Echart Chart Properties**:  
   - Ensure the output contains:
     - **Title**: Provide a chart title, and include:
       - **x-axis title** as `xAxis.name`.  
       - **y-axis title** as `yAxis.name`.  
     - **Tooltip**.  

4. **JSON Formatting Rules**:  
   - Respond with **valid compressed JSON** only (no missing commas, trailing commas, or syntax errors).  
   - **No code markers** (e.g., ```json).  
   - **No explanations**—return JSON only.  

5. **Validation**:  
   - Validate the JSON output using a linter **before responding**.  
   - If the JSON is invalid, regenerate until it passes validation.  

6. **Minimize Columns**:  
   - Pick **only necessary columns** required for the chart.  

7. **Error Handling**:  
   - If JSON is invalid or incomplete, regenerate until valid output is produced. 

### Output Format (JSON):
[
    {{
        "source": "refer to metadata source",
        "echart_options": {{}},
    }}
]

### Table Metadata:
{TABLES_METADATA}

### Available Custom Utils for ECharts:
{utils}

### Example of Applying Utils (ONLY in `dataset` field):
{{
    "dataset": [
        {{
            "source": [
                {{"product": "Matcha Latte"}},
                {{"product": "Milk Tea"}},
                {{"product": "Cheese Cocoa"}},
                {{"product": "Walnut Brownie"}},
                {{"product": "Matcha Latte"}},
                {{"product": "Milk Tea"}}
            ]
        }},
        {{
            "transform": [
                {{
                    "type": "utils:countBy",
                    "config": {{
                        "source": "product"
                    }}
                }},
                {{
                    "type": "utils:flat"
                }}
            ]
        }}
    ],
    "xAxis": {{"type": "category"}},
    "yAxis": {{}},
    "series": [
        {{
            "type": "bar",
            "datasetIndex": 1
        }}
    ]
}}
### pie chart example:
{{
    "dataset": [
        {{
            "source": [
                {{"id": "1", "category": "a"}},
                {{"id": "2", "category": "b"}},
                {{"id": "3", "category": "b"}}
            ]
        }},
        {{
            "transform": [
                {{
                    "type": "utils:countBy",
                    "config": {{
                        "source": "category"
                    }}
                }},
                {{
                    "type": "utils:flat"
                }}
            ]
        }}
    ],
    "series": [
        {{
            "name": "template",
            "type": "pie",
            "datasetIndex": 1
        }}
    ]
}}
"""


@report_routes.route("/get_data_settings", methods=["POST"])
@check_token(Position.manager)
@require_fields(["query"])
def get_data_settings(data):
    app.logger.debug(f"{g.user['email']} | request data chart")
    try:
        response = "".join(
            str(part)
            for part in openai_response(
                data["query"],
                system_content=system_content,
                streaming=False,
                model="gpt-4o",
            )
        )

        json_data = response.strip("` \n")

        if json_data.startswith("json"):
            json_data = json_data[4:]

        app.logger.debug(json_data)

    except Exception as e:
        app.logger.exception(e)

    return jsonify(json.loads(json_data)), 200
