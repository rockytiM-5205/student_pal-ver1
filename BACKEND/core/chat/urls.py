from django.urls import path
from . import views

urlpatterns = [
    path('ask/', views.AskAIView.as_view(), name='ask_ai'),
    path('history/', views.ChatHistoryView.as_view(), name='chat_history'),
]