// 0x5a17f0 Water_Reanchor size=1E3

int sub_5A17F0()
{
  int result; // eax
  int i; // edi
  int v2; // eax
  int v3; // esi
  int v4; // ebp
  int v5; // eax
  int v6; // ecx
  int v7; // ecx
  __int16 v8; // dx
  __int16 v9; // si
  int v10; // ecx
  int v11; // eax
  int v12; // edi
  int v13; // edi
  int v14; // ecx

  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  for ( i = result; result != 0; i = result )
  {
    v2 = *(_DWORD *)(i + 56);
    if ( v2 >= dword_AA1020 && v2 < dword_AA1020 + 40 )
    {
      v3 = sub_481810(4);
      v4 = sub_481810(2);
      if ( *(_DWORD *)(i + 56) == *(_DWORD *)(v3 + 56) && *(_BYTE *)(i + 282) > *(_BYTE *)(v3 + 282) )
      {
        v5 = sub_5A1350(*(_DWORD *)(i + 56));
        v6 = *(_DWORD *)(i + 56);
        if ( v5 != v6 )
        {
          v7 = *(_DWORD *)(*((_DWORD *)dword_A8ED2C + v6) + 740);
          v8 = *(_WORD *)(v3 + 36) - *(unsigned __int8 *)(v3 + 282) % v7;
          v9 = *(_WORD *)(v3 + 38) - *(unsigned __int8 *)(v3 + 282) / v7;
          if ( dword_ABED10 != nullptr )
            v10 = *((_DWORD *)dword_ABED10 + 20 * v8 + 20 * dword_89C2DC * v9 + 14);
          else
            v10 = -1;
          sub_5A6C10(v10, -1);
        }
      }
      if ( *(_DWORD *)(i + 56) == *(_DWORD *)(v4 + 56) && *(_BYTE *)(i + 282) > *(_BYTE *)(v4 + 282) )
      {
        v11 = sub_5A1350(*(_DWORD *)(i + 56));
        v12 = *(_DWORD *)(i + 56);
        if ( v11 != v12 )
        {
          v13 = *(_DWORD *)(*((_DWORD *)dword_A8ED2C + v12) + 740);
          if ( dword_ABED10 != nullptr )
            v14 = *((_DWORD *)dword_ABED10
                  + 20 * (__int16)(*(_WORD *)(v4 + 36) - *(unsigned __int8 *)(v4 + 282) % v13)
                  + 20 * dword_89C2DC * (__int16)(*(_WORD *)(v4 + 38) - *(unsigned __int8 *)(v4 + 282) / v13)
                  + 14);
          else
            v14 = -1;
          sub_5A6C10(v14, -1);
        }
      }
    }
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
