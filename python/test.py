import pandas as pd

from python.scrap_gred import compute_gred

if __name__ == "__main__":
    # data = scape_reviews("kfc changlun", 5)
    # df_reviews = data
    df_reviews = pd.read_csv("reviews_output.csv")
    compute_gred(df_reviews)

# transformer[torch]
# pip install torch --extra-index-url "https://download.pytorch.org/whl/cpu"
"""
Output:
[[
{'label': 'sadness', 'score': 0.002281982684507966}, 
{'label': 'joy', 'score': 0.9726489186286926}, 
{'label': 'love', 'score': 0.021365027874708176}, 
{'label': 'anger', 'score': 0.0026395076420158148}, 
{'label': 'fear', 'score': 0.0007162453257478774}, 
{'label': 'surprise', 'score': 0.0003483477921690792}
]]
"""
