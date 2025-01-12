import os
from datetime import datetime

import dateparser
import pandas as pd
from database import Review, Vendor, db
from flask import current_app as app
from googlemaps import GoogleMapsScraper
from transformers import AutoTokenizer, pipeline
from utils import emit_data_change
from webdriver_manager.chrome import ChromeDriverManager

from python.response import ResourceNotFoundException


def init_scraper(app):
    install_dir = os.path.join(os.getcwd(), "lib")
    lib_dir = os.path.join(install_dir, "usr/lib/x86_64-linux-gnu")
    env_file = os.path.join(os.getcwd(), ".env")
    ChromeDriverManager().install()

    if os.getenv("LD_LIBRARY_PATH", "").find(lib_dir) != -1:
        app.logger.info("Scraper successfully initialized.")
        return

    # os.makedirs(lib_dir, exist_ok=True)

    # # libasound_deb_url = "http://ftp.de.debian.org/debian/pool/main/a/alsa-lib/libasound2_1.2.4-1.1_amd64.deb"
    # deb_file_path = os.path.join(install_dir, "libasound2.deb")

    # try:
    #     app.logger.info(f"Extracting {deb_file_path} using 'ar'...")
    #     subprocess.run(["ar", "x", deb_file_path], check=True, cwd=install_dir)

    #     subprocess.run(
    #         [
    #             "tar",
    #             "-xvf",
    #             os.path.join(install_dir, "data.tar.xz"),
    #             "-C",
    #             install_dir,
    #         ],
    #         check=True,
    #     )

    # except subprocess.CalledProcessError as e:
    #     app.logger.error(f"Error extracting the package: {e}")
    #     sys.exit(1)

    # if os.path.exists(os.path.join(lib_dir, "libasound.so.2")):
    #     app.logger.info("libasound.so.2 installed successfully!")
    # else:
    #     app.logger.error("libasound.so.2 installation failed.")
    #     sys.exit(1)

    # os.remove(deb_file_path)

    os.environ["LD_LIBRARY_PATH"] = f"{lib_dir}:{os.getenv('LD_LIBRARY_PATH', '')}"

    with open(env_file, "a") as f:
        f.write(f"\nLD_LIBRARY_PATH={lib_dir}:${{LD_LIBRARY_PATH}}\n")

    app.logger.info("Scraper initialized and libasound2 installation complete.")


ind = {"most_relevant": 0, "newest": 1, "highest_rating": 2, "lowest_rating": 3}

HEADER = [
    "id_review",
    "caption",
    "relative_date",
    "retrieval_date",
    "rating",
    "username",
    "n_review_user",
    "url_user",
]


def scape_reviews(keywords, review_counts=50):
    with GoogleMapsScraper() as scraper:
        df_places = scraper.get_places(keyword_list=keywords)
        url = df_places.iloc[0]["href"]
        error = scraper.sort_by(url, ind["newest"])

        if error == 0:
            all_reviews = []
            n = 0

            while n < review_counts:
                reviews = scraper.get_reviews(n)
                if len(reviews) == 0:
                    break

                for r in reviews:
                    row_data = list(r.values())
                    all_reviews.append(row_data)

                n += len(reviews)

            if all_reviews:
                df_reviews = pd.DataFrame(all_reviews, columns=HEADER)
                # df_reviews.to_csv("reviews_output.csv", index=False)
                return df_reviews
            else:
                app.logger.debug(f"No reviews found for {keywords}")

        return pd.DataFrame()


def compute_gred(df_reviews: pd.DataFrame):
    model_name = "bhadresh-savani/albert-base-v2-emotion"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    sentiment_analyzer = pipeline(
        "text-classification",
        model=model_name,
        tokenizer=tokenizer,
        top_k=1,
        max_length=512,
        padding="max_length",
        truncation=True,
    )

    sentiment_mapping = dict(
        joy=1.0,
        love=0.9,
        surprise=0.7,
        sadness=-0.6,
        fear=-0.8,
        anger=-0.9,
        neutral=0.0,
    )

    gred_scores = []

    for _, review in df_reviews.iterrows():
        rating = review["rating"]
        caption = review["caption"]

        if pd.notna(caption):
            result = sentiment_analyzer(caption)

            if result and isinstance(result, list) and len(result) > 0:
                sentiment_label = str(result[0][0]["label"])
                sentiment_score = float(result[0][0]["score"])

                sentiment_factor = sentiment_mapping.get(sentiment_label, 0.0)

                combined_gred = (sentiment_score * 100 * sentiment_factor * 0.5) + (
                    rating / 5 * 100 * 0.5
                )
                gred_scores.append(combined_gred)
            else:
                app.logger.debug("Scrapped reviews infer result is not filled list")
                return
        else:
            gred_scores.append(rating / 5 * 100)

    overall_gred = sum(gred_scores) / len(gred_scores) if len(gred_scores) > 0 else 0

    return overall_gred


def assess_vendor(id, name, address, app_context):
    with app_context:
        app.logger.debug(f"Begin assessing of vendor: {name}")
        df_reviews = scape_reviews([f"{name} {address}"], 50)
        if not df_reviews.empty:
            gred = compute_gred(df_reviews)
            app.logger.debug(
                f"Finished Assessment. id: {id}, name: {name}, score: {gred}"
            )
            v = db.session.get(Vendor, id)

            if not v:
                raise ResourceNotFoundException("vendor", id)

            v.gred = gred or 0

            Review.query.filter_by(vendor_id=id).delete()

            for _, review in df_reviews.iterrows():
                relative_date = review["relative_date"]
                retrieval_date_str = review["retrieval_date"].strftime(
                    "%Y-%m-%d %H:%M:%S.%f"
                )
                retrieval_date = datetime.strptime(
                    retrieval_date_str, "%Y-%m-%d %H:%M:%S.%f"
                )

                res = dateparser.parse(
                    relative_date, settings={"RELATIVE_BASE": retrieval_date}
                )
                db.session.add(
                    Review(
                        vendor_id=id,
                        rating=review["rating"],
                        caption=review["caption"],
                        date=res,
                    )
                )

            db.session.commit()
            emit_data_change("cast", "modify", v)
