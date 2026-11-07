"""Auth API routes."""

from django.urls import path

from apps.accounts import views

urlpatterns = [
    path("me", views.MeView.as_view()),
    path("login", views.LoginView.as_view()),
    path("demo-users", views.DemoUsersView.as_view()),
    path("demo-login", views.DemoLoginView.as_view()),
    path("logout", views.LogoutView.as_view()),
]
