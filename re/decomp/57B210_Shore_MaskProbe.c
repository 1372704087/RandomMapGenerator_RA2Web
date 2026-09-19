// 0x57b210 Shore_MaskProbe size=225

int __thiscall sub_57B210(_DWORD *this, _DWORD *a2, int a3)
{
  int v3; // ebx
  int v5; // esi
  int v6; // eax
  int result; // eax
  int v8; // eax
  int v9; // eax
  int v10; // edx
  int v11; // esi
  int v12; // ecx
  _DWORD *v13; // esi
  char v14; // bl
  int v15; // edi
  int v16; // ecx
  _DWORD *v17; // esi
  int v18; // ecx
  _DWORD *v19; // esi
  int v20; // ecx
  _DWORD *v21; // esi
  int v22; // ecx
  _DWORD *v23; // esi
  int v24; // ecx
  _DWORD *v25; // esi
  int v26; // ecx
  _DWORD *v27; // esi
  int v28; // ecx
  _DWORD *v29; // esi
  int v30; // [esp+18h] [ebp-8h]
  char v32; // [esp+24h] [ebp+4h]

  v3 = dword_AA0738;
  v5 = a2[9];
  v30 = dword_AA0738 + 14;
  v32 = sub_485060(a2);
  v6 = SHIWORD(v5) + (__int16)v5;
  if ( v6 <= dword_ABED04
    || (__int16)v5 - SHIWORD(v5) >= dword_ABED04
    || SHIWORD(v5) - (__int16)v5 >= dword_ABED04
    || v6 > dword_ABED08 )
  {
    return 0;
  }
  if ( a3 != 0 )
  {
    if ( a3 == 1 )
    {
      v8 = a2[14];
      if ( v8 >= v3 && v8 < v30 )
        return 0;
    }
  }
  else if ( !sub_486380(a2) )
  {
    return 0;
  }
  a3 = a2[9];
  v9 = sub_58C2A0(&a3);
  if ( *(_BYTE *)(v9 + 74) == 0 )
    return 0;
  result = *(_DWORD *)(v9 + 64);
  if ( result < 0 )
  {
    v10 = *(this + 79);
    v11 = (__int16)v5 + (SHIWORD(v5) << 9);
    v12 = *(_DWORD *)(v10 + 4 * v11 - 2052);
    v13 = (_DWORD *)(v10 + 4 * v11 - 2052);
    if ( v12 != 0 && (unsigned __int8)sub_485060(v12) != 0 )
    {
      v14 = v32;
      v15 = 64;
    }
    else if ( *v13 != 0 )
    {
      v15 = 0;
      v14 = v32;
    }
    else
    {
      v14 = v32;
      if ( v32 != 0 )
        v15 = 64;
      else
        v15 = 0;
    }
    v16 = v13[1];
    v17 = v13 + 1;
    if ( v16 != 0 && (unsigned __int8)sub_485060(v16) != 0 || *v17 == 0 && v14 != 0 )
      v15 |= 0x80u;
    v18 = v17[1];
    v19 = v17 + 1;
    if ( v18 != 0 && (unsigned __int8)sub_485060(v18) != 0 || *v19 == 0 && v14 != 0 )
      v15 |= 1u;
    v20 = v19[510];
    v21 = v19 + 510;
    if ( v20 != 0 && (unsigned __int8)sub_485060(v20) != 0 || *v21 == 0 && v14 != 0 )
      v15 |= 0x20u;
    v22 = v21[2];
    v23 = v21 + 2;
    if ( v22 != 0 && (unsigned __int8)sub_485060(v22) != 0 || *v23 == 0 && v14 != 0 )
      v15 |= 2u;
    v24 = v23[510];
    v25 = v23 + 510;
    if ( v24 != 0 && (unsigned __int8)sub_485060(v24) != 0 || *v25 == 0 && v14 != 0 )
      v15 |= 0x10u;
    v26 = v25[1];
    v27 = v25 + 1;
    if ( v26 != 0 && (unsigned __int8)sub_485060(v26) != 0 || *v27 == 0 && v14 != 0 )
      v15 |= 8u;
    v28 = v27[1];
    v29 = v27 + 1;
    if ( v28 != 0 && (unsigned __int8)sub_485060(v28) != 0 || *v29 == 0 && v14 != 0 )
      return v15 | 4;
    return v15;
  }
  return result;
}
