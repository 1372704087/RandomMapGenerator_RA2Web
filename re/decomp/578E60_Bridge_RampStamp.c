// 0x578e60 Bridge_RampStamp size=1AC

char __stdcall sub_578E60(int a1, int a2)
{
  char v2; // bl
  int v3; // esi
  char *v4; // ebp
  char *v5; // edi
  int v6; // edi
  int i; // esi
  int v8; // eax
  int j; // eax
  int k; // esi
  char v12; // [esp+13h] [ebp-5h]

  v2 = 1;
  v12 = 0;
  if ( dword_ABED10 == nullptr )
  {
    v3 = dword_89C2DC * dword_89C2DC;
    v4 = (char *)operator new(80 * dword_89C2DC * dword_89C2DC);
    if ( v4 != nullptr )
    {
      v5 = v4;
      if ( v3 - 1 >= 0 )
      {
        do
        {
          sub_58BDC0(v5);
          v5 += 80;
          --v3;
        }
        while ( v3 != 0 );
      }
      dword_ABED10 = v4;
    }
    else
    {
      dword_ABED10 = nullptr;
    }
    v12 = 1;
  }
  v6 = dword_89C2DC * dword_89C2DC;
  for ( i = 0; i < v6; *(_BYTE *)(v8 + 74) = 1 )
    v8 = sub_58C2C0(i++);
  sub_4A8BF0(0);
  dword_87F8F8 = dword_87F8DC;
  dword_87F8F4 = 1;
  dword_87F8FC = dword_87F8DC - 1;
  dword_87F900 = (dword_87F8DC << 11) + dword_87F924 + 4;
  for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
  {
    if ( v2 == 0 )
      break;
    v2 = sub_579010(j, a2);
  }
  dword_87F8F8 = dword_87F8DC;
  dword_87F8F4 = 1;
  dword_87F8FC = dword_87F8DC - 1;
  dword_87F900 = (dword_87F8DC << 11) + dword_87F924 + 4;
  for ( k = sub_578290(&stru_87F7E8); k != 0; k = sub_578290(&stru_87F7E8) )
  {
    if ( v2 == 0 )
      break;
    if ( *(_BYTE *)(k + 284) == 0 && sub_486380((_DWORD *)k) )
      v2 = sub_579620(k, a2);
  }
  dword_880990 = 0;
  if ( dword_88098C != 0 )
  {
    (*(void (__thiscall **)(int, int))(*(_DWORD *)dword_88098C + 32))(dword_88098C, 1);
    dword_88098C = 0;
  }
  if ( v12 != 0 )
  {
    operator delete(dword_ABED10);
    dword_ABED10 = nullptr;
  }
  return v2;
}
