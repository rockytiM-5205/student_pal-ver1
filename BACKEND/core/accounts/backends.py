# from django.contrib.auth.backends import ModelBackend
# from .models import User

# class MatricNumberBackend(ModelBackend):
#     def authenticate(self, request, matric_number=None, password=None, **kwargs):
#         try:
#             user = User.objects.get(matric_number=matric_number)
#         except User.DoesNotExist:
#             return None

#         if user.check_password(password):
#             return user
#         return None
