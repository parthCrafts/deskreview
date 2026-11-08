"""Root URL configuration."""

from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from common.errors import api_not_found
from common.health import health
from common.spa import index as spa_index

handler404 = "common.errors.json_404"
handler500 = "common.errors.json_500"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/admin/", include("apps.accounts.admin_urls")),
    path("api/v1/", include("apps.documents.api.urls")),
    path("api/v1/", include("apps.assist.api.urls")),
    re_path(r"^api/.*$", api_not_found),
    re_path(r"^(?!api/|static/|admin/).*$", spa_index),
]
