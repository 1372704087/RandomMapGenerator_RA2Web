// 0x59bab0 Blob_EllipseTest size=10C

char __stdcall sub_59BAB0(__int16 *a1, int *a2, char a3, double a4, double a5)
{
  int v5; // esi
  int v7; // edx
  double v8; // st7
  double v9; // st6
  int v10; // eax
  int v11; // edx
  int v12; // eax

  v5 = *a2;
  if ( *a2 == dword_ABE2F0 && a2[1] == dword_ABE2F4 && a2[2] == dword_ABE2F8 && a2[3] == dword_ABE2FC )
    return 1;
  if ( a3 != 0 )
  {
    v7 = a1[1];
    v8 = (double)(*a1 - 2 * v5 - v7 + dword_87F8DC - 1) * 0.5 - (double)a2[2] * 0.5;
    v9 = (double)(*a1 - 2 * a2[1] - dword_87F8DC + v7 - 1) * 0.5 - (double)a2[3] * 0.5;
    if ( v9 * v9 * a5 + v8 * v8 * a4 < 1.0 )
      return 1;
  }
  else
  {
    v10 = *a1;
    v11 = a1[1];
    if ( v10 >= v5 && v10 < v5 + a2[2] )
    {
      v12 = a2[1];
      if ( v11 >= v12 && v11 < v12 + a2[3] )
        return 1;
    }
  }
  return 0;
}
