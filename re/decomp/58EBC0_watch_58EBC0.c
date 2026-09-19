// 0x58ebc0 watch_58EBC0 size=2D8

int sub_58EBC0()
{
  int i; // esi
  _DWORD *v1; // ecx
  int v2; // eax
  int v3; // esi
  int v4; // edx
  int v5; // ecx
  int v6; // edi
  int v7; // ebp
  int v8; // eax
  int v9; // ebx
  int v10; // esi
  int v11; // eax
  int v12; // esi
  int v13; // ecx
  int v14; // eax
  int *v15; // eax
  int v16; // ecx
  int v17; // esi
  int v18; // ecx
  int v19; // esi
  bool v20; // zf
  double v21; // st7
  int v22; // ebx
  int result; // eax
  int j; // edi
  int v25; // esi
  int v26; // eax
  void *v27; // eax
  int v28; // [esp+10h] [ebp-Ch]
  int v29; // [esp+14h] [ebp-8h]
  int v30; // [esp+18h] [ebp-4h] BYREF

  for ( i = 0; i < dword_ABDFA0; v1[3] = 0 )
  {
    (*(void (__thiscall **)(int))(*(_DWORD *)(*((_DWORD *)dword_ABDF94 + i) + 40) + 12))(*((_DWORD *)dword_ABDF94 + i) + 40);
    *(_DWORD *)(*((_DWORD *)dword_ABDF94 + i) + 12) = 0;
    v1 = (_DWORD *)(*((_DWORD *)dword_ABDF94 + i++) + 64);
    *v1 = 9999;
    v1[1] = 9999;
    v1[2] = 0;
  }
  v2 = dword_89C2DC * dword_89C2DC - 1;
  if ( v2 >= 0 )
  {
    v3 = dword_ABED04;
    v4 = 80 * v2;
    v28 = 80 * v2;
    v30 = dword_89C2DC * dword_89C2DC;
    while ( 1 )
    {
      v5 = *(_DWORD *)((char *)dword_ABED10 + v4);
      v29 = v5;
      v6 = SHIWORD(v5);
      v7 = (__int16)v5;
      v8 = SHIWORD(v5) + (__int16)v5;
      if ( v8 > v3 && (__int16)v5 - SHIWORD(v5) < v3 && SHIWORD(v5) - (__int16)v5 < v3 && v8 <= dword_ABED08 )
      {
        v9 = *(_DWORD *)((char *)dword_ABED10 + v4 + 56);
        if ( v9 >= 0 && v9 < dword_ABDFA0 )
          break;
      }
LABEL_30:
      v4 -= 80;
      v20 = v30 == 1;
      v28 = v4;
      --v30;
      if ( v20 )
        goto LABEL_31;
    }
    ++*(_DWORD *)(*((_DWORD *)dword_ABDF94 + v9) + 12);
    v10 = *((_DWORD *)dword_ABDF94 + v9);
    v11 = *(_DWORD *)(v10 + 48);
    v12 = v10 + 40;
    if ( *(_DWORD *)(v12 + 16) >= v11 )
    {
      if ( *(_BYTE *)(v12 + 13) == 0 && v11 != 0 )
        goto LABEL_19;
      v13 = *(_DWORD *)(v12 + 20);
      if ( v13 <= 0 )
        goto LABEL_19;
      if ( (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v12 + 8))(v12, v11 + v13, 0) == 0 )
      {
LABEL_18:
        v4 = v28;
LABEL_19:
        v15 = (int *)(*((_DWORD *)dword_ABDF94 + v9) + 64);
        if ( *(_DWORD *)(*((_DWORD *)dword_ABDF94 + v9) + 72) == 0 )
        {
          *v15 = v7;
          v15[1] = v6;
          v15[2] = 1;
          v15[3] = 1;
        }
        v16 = *v15;
        if ( v7 >= v15[2] + *v15 )
          v15[2] = v7 - v16 + 1;
        if ( v7 < v16 )
        {
          v17 = v15[2];
          *v15 = v7;
          v15[2] = v16 - v7 + v17;
        }
        v18 = v15[1];
        if ( v6 >= v15[3] + v18 )
          v15[3] = v6 - v18 + 1;
        if ( v6 < v18 )
        {
          v19 = v15[3];
          v15[1] = v6;
          v15[3] = v18 - v6 + v19;
        }
        v3 = dword_ABED04;
        goto LABEL_30;
      }
      v5 = v29;
    }
    v14 = *(_DWORD *)(v12 + 16);
    *(_DWORD *)(v12 + 16) = v14 + 1;
    *(_DWORD *)(*(_DWORD *)(v12 + 4) + 4 * v14) = v5;
    goto LABEL_18;
  }
LABEL_31:
  v21 = ((double)dword_ABE048 * 0.005 + 0.05) * (double)dword_ABE15C * (double)dword_ABE158;
  v22 = sub_7C5F00(v21 + v21);
LABEL_32:
  result = dword_ABDFA0;
  for ( j = 0; j < dword_ABDFA0; ++j )
  {
    v25 = *((_DWORD *)dword_ABDF94 + j);
    if ( *(_BYTE *)(v25 + 26) == 0 && *(_BYTE *)(v25 + 20) == 0 )
    {
      if ( *(_DWORD *)(v25 + 12) <= v22 )
      {
        *(_BYTE *)(v25 + 26) = 1;
      }
      else if ( sub_58D620(*((_DWORD *)dword_ABDF94 + j)) != 0 )
      {
        if ( v25 != 0 )
        {
          if ( *(_DWORD *)v25 != 0 )
          {
            (***(void (__thiscall ****)(_DWORD, int))v25)(*(_DWORD *)v25, 1);
            *(_DWORD *)v25 = 0;
          }
          v30 = v25;
          v26 = (*(int (__thiscall **)(int *, int *))(dword_ABDF90 + 16))(&dword_ABDF90, &v30);
          if ( v26 != -1 && v26 < dword_ABDFA0 && v26 < --dword_ABDFA0 )
          {
            do
            {
              ++v26;
              *((_DWORD *)dword_ABDF94 + v26 - 1) = *((_DWORD *)dword_ABDF94 + v26);
            }
            while ( v26 < dword_ABDFA0 );
          }
          v27 = *(void **)(v25 + 44);
          *(_DWORD *)(v25 + 40) = &VectorClass<Cell>::`vftable';
          if ( v27 != nullptr && *(_BYTE *)(v25 + 53) != 0 )
          {
            operator delete(v27);
            *(_DWORD *)(v25 + 44) = 0;
          }
          *(_BYTE *)(v25 + 53) = 0;
          *(_DWORD *)(v25 + 48) = 0;
          operator delete((void *)v25);
        }
        goto LABEL_32;
      }
    }
    result = dword_ABDFA0;
  }
  return result;
}
