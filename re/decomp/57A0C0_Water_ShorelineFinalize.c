// 0x57a0c0 Water_ShorelineFinalize size=253

char __stdcall sub_57A0C0(int a1, int a2)
{
  int v2; // esi
  char *v3; // eax
  void *v4; // ebx
  int v5; // esi
  char *v6; // edi
  int v7; // esi
  int v8; // esi
  int i; // edi
  int v10; // eax
  int v11; // eax
  char j; // bl
  int k; // eax
  int m; // eax
  int n; // eax
  char v17; // [esp+13h] [ebp-1h]

  sub_4A8BF0(0);
  v17 = 0;
  if ( dword_ABED10 == nullptr )
  {
    v2 = dword_89C2DC * dword_89C2DC;
    v3 = (char *)operator new(80 * dword_89C2DC * dword_89C2DC);
    v4 = v3;
    if ( v3 != nullptr )
    {
      v5 = v2 - 1;
      v6 = v3;
      if ( v5 >= 0 )
      {
        v7 = v5 + 1;
        do
        {
          sub_58BDC0(v6);
          v6 += 80;
          --v7;
        }
        while ( v7 != 0 );
      }
      dword_ABED10 = v4;
    }
    else
    {
      dword_ABED10 = nullptr;
    }
    v17 = 1;
  }
  v8 = 0;
  for ( i = dword_89C2DC * dword_89C2DC; v8 < i; *(_DWORD *)(v10 + 64) = -1 )
    v10 = sub_58C2C0(v8++);
  dword_87F8F8 = dword_87F8DC;
  dword_87F8F4 = 1;
  dword_87F8FC = dword_87F8DC - 1;
  dword_87F900 = (dword_87F8DC << 11) + dword_87F924 + 4;
  v11 = sub_578290(&stru_87F7E8);
  for ( j = 1; v11 != 0; v11 = sub_578290(&stru_87F7E8) )
  {
    if ( j == 0 )
      break;
    j = sub_57A430(v11, a1, a2);
  }
  dword_87F8F8 = dword_87F8DC;
  dword_87F8F4 = 1;
  dword_87F8FC = dword_87F8DC - 1;
  dword_87F900 = (dword_87F8DC << 11) + dword_87F924 + 4;
  for ( k = sub_578290(&stru_87F7E8); k != 0; k = sub_578290(&stru_87F7E8) )
  {
    if ( j == 0 )
      break;
    sub_57A320(k, a1, a2);
  }
  dword_87F8F8 = dword_87F8DC;
  dword_87F8F4 = 1;
  dword_87F8FC = dword_87F8DC - 1;
  dword_87F900 = (dword_87F8DC << 11) + dword_87F924 + 4;
  for ( m = sub_578290(&stru_87F7E8); m != 0; m = sub_578290(&stru_87F7E8) )
  {
    if ( j == 0 )
      break;
    j = sub_57ACF0(m, 1, a1, a2);
  }
  dword_87F8F8 = dword_87F8DC;
  dword_87F8F4 = 1;
  dword_87F8FC = dword_87F8DC - 1;
  dword_87F900 = (dword_87F8DC << 11) + dword_87F924 + 4;
  for ( n = sub_578290(&stru_87F7E8); n != 0; n = sub_578290(&stru_87F7E8) )
  {
    if ( j == 0 )
      break;
    j = sub_57ACF0(n, 2, a1, a2);
  }
  dword_880990 = 0;
  if ( dword_88098C != 0 )
  {
    (*(void (__thiscall **)(int, int))(*(_DWORD *)dword_88098C + 32))(dword_88098C, 1);
    dword_88098C = 0;
  }
  if ( v17 != 0 )
  {
    operator delete(dword_ABED10);
    dword_ABED10 = nullptr;
  }
  return j;
}
