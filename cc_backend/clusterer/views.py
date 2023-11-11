from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt

from clusterer.forms import EnterTickerForm
from clusterer.utils import get_companies_from_db, get_company_from_api, get_unique_field_names, text_to_array, sanitize_text
from clusterer.analyses import K_Means

# Create your views here.

@csrf_exempt
def index(request):
    form = EnterTickerForm()
    companies = get_companies_from_db()
    context = {
        "form": form,
        "companies": companies,
    }
    return render(request, "clusterer/index.html", context)

@csrf_exempt
def get_company(request):
    if request.method == 'POST':
        form = EnterTickerForm(request.POST)
        # Check if the form is valid:
        if form.is_valid():
            # process the data in form.cleaned_data as required
            k = form.cleaned_data['k']
            dimensions_txt = form.cleaned_data['dimensions']
            dimensions_txt = sanitize_text(dimensions_txt)
            dimensions = ['']
            if dimensions_txt:
                dimensions = text_to_array(dimensions_txt)
            txt = form.cleaned_data['ticker']
            txt = txt.upper()
            txt = sanitize_text(txt)
            tickers = text_to_array(txt)
            if len(txt) == 0:
                tickers = []

            retrieved_companies = get_companies_from_db(tickers=tickers)
            missing_companies = list()

            # If some companies are not found from the db, try to get from API
            if tickers and len(retrieved_companies) != len(tickers):
                found_companies = [comp['symbol'] for comp in retrieved_companies]
                
                set1 = set(tickers)
                set2 = set(found_companies)

                missing_companies = list(sorted(set1 - set2))

                retrieved_from_api = get_company_from_api(missing_companies)
                found_companies += [comp['symbol'] for comp in retrieved_from_api]
                set2 = set(found_companies)
                missing_companies = list(sorted(set1 - set2))

            unique_field_names = get_unique_field_names(dimensions)
            retrieved_companies = get_companies_from_db(return_fields=unique_field_names)
            company_clusterings, metrics = K_Means(retrieved_companies, dimensions, k)
            if company_clusterings and "error" in company_clusterings[0]:
                return HttpResponseBadRequest(reason=company_clusterings[0]['error'], content_type='text/plain')

            return JsonResponse({'companies': company_clusterings,
                                 'missing_companies': missing_companies,
                                 'metrics': metrics
                                })
        return HttpResponseBadRequest(reason="Input is not clean", content_type='text/plain')
    else:
        return HttpResponseBadRequest(reason="Was not POST request", content_type='text/plain')
