import os
import requests
import re
import pymongo

API_KEY = os.environ.get('API_KEY')
DB_USERNAME = os.environ.get('DB_USERNAME')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_CLUSTERHOST = os.environ.get('DB_CLUSTERHOST')
connection_string = f'mongodb+srv://{DB_USERNAME}:{DB_PASSWORD}@{DB_CLUSTERHOST}?retryWrites=true&w=majority'
client = pymongo.MongoClient(connection_string)
financial_db = client['financial_data']
collection = financial_db['companyfinancials']

def get_companies_from_db(tickers=[], return_fields=[]):
    return_fields_dict = {'_id': False, 'symbol': True}
    for field in return_fields:
        return_fields_dict[field] = True
    filter_fields_dict = {}
    for field in return_fields:
        filter_fields_dict[field] = {'$ne': None}

    if not tickers:
        result = collection.find(filter_fields_dict, return_fields_dict)
    else:
        filter_fields_dict['symbol'] = {"$in": tickers}
        result = collection.find(filter_fields_dict, return_fields_dict)
    results_list = [res for res in result]
    return results_list

def get_company_from_api(tickers):
    if not tickers:
        return []
    companies = []
    for ticker in tickers:
        company = {'symbol':ticker}

        # To save resources, we will only get the balance sheet and income statement
        # for the latest year. Uncomment below if you also need other data.

        # url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker}&apikey={API_KEY}'
        # retrieved_company = requests.get(url).json()
        # rem_list = ['Description', 'Symbol']
        # if "Information" in retrieved_company and retrieved_company['Information'][:19] == 'Thank you for using':
        #     return companies
        # for key in rem_list:
        #     retrieved_company.pop(key, None)
        # company.update(retrieved_company)

        urls = []
        urls.append(f'https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol={ticker}&apikey={API_KEY}')
        urls.append(f'https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol={ticker}&apikey={API_KEY}')
        #urls.append(f'https://www.alphavantage.co/query?function=CASH_FLOW&symbol={ticker}&apikey={API_KEY}')

        for url in urls:
            retrieved_company = requests.get(url).json()
            # Check API request limits are not exceeded
            if "Information" in retrieved_company and retrieved_company['Information'][:19] == 'Thank you for using':
                return companies
            company.update(retrieved_company['annualReports'][0])

        collection.insert_one(company)
        del company['_id']
        companies.append(company)
    return companies

def is_ajax(request):
    return request.META.get('HTTP_X_REQUESTED_WITH') == 'XMLHttpRequest'

def get_unique_field_names(dimensions):
    field_names = set()
    for dimension in dimensions:
        dimension = ''.join(dimension.split())
        chars_to_skip = '+-*/^()0123456789'
        field_name = ''
        for char in dimension:
            if char in chars_to_skip:
                if field_name:
                    field_names.add(field_name)
                field_name = ''
            else:
                field_name += char
        if field_name:
            field_names.add(field_name)
    return field_names

def replace_field_names_with_values(dimension, company):
    dimension = ''.join(dimension.split())
    chars_to_skip = '+-*/^()0123456789.,'
    new_expression = ''
    field_name = ''
    for char in dimension:
        if char in chars_to_skip:
            if field_name:
                new_expression += '(' + str(company[field_name]) + ')'
            field_name = ''
            new_expression += char
        else:
            field_name += char
    if field_name:
        new_expression += '(' + str(company[field_name]) + ')'
    return new_expression

def check_and_fix_expression(expression):
    if expression[0] in '-+':
        expression = '0' + expression
    n = len(expression)
    fixed_expression = ''
    for i in range(n):
        if i < n-1 and expression[i] == '(' and expression[i+1] in '-+':
            fixed_expression += '(0'
        else:
            fixed_expression += expression[i]
    return fixed_expression

def calculate_dimensions(retrieved_companies, dimensions):
    # If the dimension is simply a field, it does not need to be evaluated
    need_to_evaluate = []
    symbols = ['+', '-', '*', '/', '^', '(', ')']
    for dimension in dimensions:
        res = [ele for ele in symbols if (ele in dimension)]
        need_to_evaluate.append(bool(res))

    modified_companies = []
    for company in retrieved_companies:
        append_company = True
        modified_company = {}
        modified_company['symbol'] = company['symbol']
        for i in range(len(dimensions)):
            if need_to_evaluate[i]:
                expression = replace_field_names_with_values(dimensions[i], company)
                expression = check_and_fix_expression(expression)
                try:
                    modified_company[f'dimension{i+1}'] = evaluate_expression(expression)
                except ValueError:
                    append_company = False
                except IndexError:
                    append_company = False
                except ZeroDivisionError:
                    append_company = False
            else:
                try:
                    modified_company[f'dimension{i+1}'] = float(company[dimensions[i]])
                except ValueError:
                    append_company = False
        if append_company:
            modified_companies.append(modified_company)

    return modified_companies

def evaluate_expression(expression):
    for char in expression:
        if char not in '0123456789+-*/^().,':
            raise ValueError
    def apply_operator(operators, values):
        operator = operators.pop()
        right = values.pop()
        left = values.pop()
        if operator == '+':
            values.append(left + right)
        elif operator == '-':
            values.append(left - right)
        elif operator == '*':
            values.append(left * right)
        elif operator == '/':
            values.append(left / right)
        elif operator == '^':
            values.append(left ** right)

    def precedence(operator):
        if operator in ('+', '-'):
            return 1
        if operator in ('*', '/'):
            return 2
        if operator == '^':
            return 3
        return 0

    def evaluate(tokens):
        operators = []
        values = []
        i = 0
        while i < len(tokens):
            if tokens[i] == ' ':
                i += 1
                continue
            if re.match(r'^-?[0-9.]+$', tokens[i]):
                j = i
                while i < len(tokens) and re.match(r'^-?[0-9.]+$', tokens[i]):
                    i += 1
                values.append(float("".join(tokens[j:i])))
            elif tokens[i] in '+-*/^':
                while (operators and operators[-1] in '+-*/^' and
                       precedence(operators[-1]) >= precedence(tokens[i])):
                    apply_operator(operators, values)
                operators.append(tokens[i])
                i += 1
            elif tokens[i] == '(':
                operators.append(tokens[i])
                i += 1
            elif tokens[i] == ')':
                while operators[-1] != '(':
                    apply_operator(operators, values)
                operators.pop()
                i += 1
            else:
                raise ValueError("Invalid character in expression")
        while operators:
            apply_operator(operators, values)
        return values[0]

    tokens = re.findall(r'\d+\.\d+|\d+|[+-/*^()]', expression)
    result = evaluate(tokens)
    return result

def text_to_array(text, deliminator=','):
    return_array = []
    for x in text.split(deliminator):
        if x:
            return_array.append(x.strip())
    return return_array

def sanitize_text(text):
    text_string = str(text)
    for char in text_string:
        if char in ':}{$':
            return ''
    return text_string
