from django import forms

class EnterTickerForm(forms.Form):
    ticker = forms.CharField(required=False)
    dimensions = forms.CharField(required=False)
    k = forms.IntegerField(required=False)

    def clean_ticker(self):
        data = self.cleaned_data['ticker']
        return data

    def clean_dimensions(self):
        data = self.cleaned_data['dimensions']
        return data

    def clean_k(self):
        data = self.cleaned_data['k']
        if not data:
            data = 0
        return data

