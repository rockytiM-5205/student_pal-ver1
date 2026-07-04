from django.urls import path
from . import views

urlpatterns = [
    path('', views.NoteListView.as_view(), name='note_list'),
    path('<int:pk>/', views.NoteDetailView.as_view(), name='note_detail'),
    path('upload/', views.NoteUploadView.as_view(), name='note_upload'),
    path('<int:pk>/delete/', views.NoteDeleteView.as_view(), name='note_delete'),
    path('<int:pk>/bookmark/', views.BookmarkToggleView.as_view(), name='bookmark_toggle'),
    path('<int:pk>/download/', views.NoteDownloadView.as_view(), name='note_download'),
    path('<int:pk>/share/', views.NoteShareView.as_view(), name='note_share'),
    path('bookmarks/', views.BookmarkListView.as_view(), name='bookmark_list'),
    path('<int:pk>/approve/', views.NoteApproveView.as_view(), name='note_approve'),
    path('<int:pk>/reject/',  views.NoteRejectView.as_view(),  name='note_reject'),
]