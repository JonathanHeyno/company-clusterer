from django.urls import path
from . import views

app_name = "clusterer"
urlpatterns = [
    path('', views.index, name='index'),
    path('clusterer', views.index, name='clusterer'),
    path('get_company/', views.get_company, name='getcompany'),
    ]
