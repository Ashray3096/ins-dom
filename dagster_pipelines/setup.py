from setuptools import setup, find_packages

setup(
    name="inspector_dom_pipelines",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "dagster",
        "dagster-webserver",
        "supabase",
        "boto3",
        "requests",
        "beautifulsoup4",
        "lxml",
        "jsonpath-ng",
    ],
)
