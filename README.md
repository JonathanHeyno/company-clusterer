# Company Clusterer
The app can be tested at [https://company-clusterer.fly.dev](https://company-clusterer.fly.dev)
## Description
Company Clusterer is an application that performs a K-Means clustering for companies based on dimensions given. You can add as many dimensions as you want separated by a comma and form them as an expression using ‘+-*/^()’ based on fields available on the companies’ balance sheets and income statements. For example, to form a clustering based on three dimensions, something like this could be formed:

`grossProfit / totalRevenue, currentDebt / grossProfit, researchAndDevelopment / sellingGeneralAndAdministrative`

If the number of clusters is not defined, it will be determined automatically. The app can also retrieve and include data for a company missing from the dataset for the analysis.

The result can be viewed on an interactive plot where you can change the dimensions on the x and y axes, allowing you to study different cross sections of the clustering.

## Installation
The server is written with Django for a Mongo database.
- Install the requirements in [requirements.txt](cc_backend/requirements.txt) e.g. with pip `$ pip install -r requirements.txt`
- Add an environment variable for `SECRET_KEY`.
- Modify the connection strings in [cc_backend/clusterer/utils.py](cc_backend/clusterer/utils.py) to connect to your database and external API for retrieving data, and add the required environment variables to your system.
- Start normally as any Django project ` py manage.py runserver`
