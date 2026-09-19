// 0x594f40 Start_FarthestSelector size=4B4

_DWORD *__thiscall sub_594F40(int *this, int a2)
{
  int v2; // esi
  int v3; // eax
  int v4; // ebx
  _DWORD *v6; // esi
  int v7; // edx
  _DWORD *v8; // edi
  int v9; // ecx
  int v10; // ebx
  int v11; // esi
  double v12; // st7
  double v13; // st7
  _DWORD *v14; // ebx
  int v15; // eax
  int v16; // ecx
  int v17; // eax
  int v18; // edx
  int v19; // edx
  int v20; // eax
  _DWORD *v21; // ebx
  int v22; // ecx
  int v23; // eax
  int v24; // edx
  int v25; // ecx
  int v26; // ebx
  int v27; // esi
  double v28; // st7
  double v29; // st7
  int v30; // eax
  int v31; // ecx
  int v32; // eax
  int v33; // edx
  int v34; // [esp+14h] [ebp-34h]
  int v35; // [esp+14h] [ebp-34h]
  _DWORD *v36; // [esp+18h] [ebp-30h]
  int v37; // [esp+1Ch] [ebp-2Ch]
  int v38; // [esp+20h] [ebp-28h]
  double v39; // [esp+20h] [ebp-28h]
  int v40; // [esp+2Ch] [ebp-1Ch]
  int v41; // [esp+2Ch] [ebp-1Ch]
  int v42; // [esp+30h] [ebp-18h]
  int v43; // [esp+30h] [ebp-18h]
  int v44; // [esp+34h] [ebp-14h]
  int v45; // [esp+34h] [ebp-14h]
  int v46; // [esp+38h] [ebp-10h]
  int v47; // [esp+38h] [ebp-10h]
  int v48; // [esp+3Ch] [ebp-Ch]
  _DWORD *v49; // [esp+3Ch] [ebp-Ch]
  double v50; // [esp+40h] [ebp-8h]
  double v51; // [esp+40h] [ebp-8h]

  v2 = *(this + 8);
  v50 = -1.0;
  v42 = -1;
  v3 = sub_7C5F00(((double)dword_ABE030 * 0.01 * 12.0 / (double)dword_ABE028 + 2.0) * (double)v2);
  v4 = a2;
  v37 = v3;
  if ( v2 == 0 && *(int *)(a2 + 16) > 0 )
  {
    v37 = *(_DWORD *)(a2 + 16);
    v3 = v37;
  }
  if ( v3 > *(_DWORD *)(a2 + 16) || v3 == 0 )
  {
    if ( v2 == 0 )
      return nullptr;
    v37 = *(_DWORD *)(a2 + 16);
  }
  v6 = operator new(0x18u);
  if ( v6 != nullptr )
  {
    sub_42FCB0(0, 0);
    *v6 = &DynamicVectorClass<Cell>::`vftable';
    v6[5] = 10;
    v6[4] = 0;
    v36 = v6;
  }
  else
  {
    v36 = nullptr;
    v6 = nullptr;
  }
  v7 = *(_DWORD *)(a2 + 16);
  v34 = 0;
  v8 = dword_ABED10;
  if ( v7 - 1 > 0 )
  {
    while ( 1 )
    {
      v9 = *(_DWORD *)(*(_DWORD *)(v4 + 4) + 4 * v34);
      if ( v8 != nullptr )
        v40 = v8[20 * (__int16)v9 + 14 + 20 * dword_89C2DC * SHIWORD(v9)];
      else
        v40 = -1;
      v10 = v34 + 1;
      if ( v34 + 1 < v7 )
      {
        v44 = (__int16)v9;
        v46 = SHIWORD(v9);
        do
        {
          v38 = *(_DWORD *)(*(_DWORD *)(a2 + 4) + 4 * v10);
          if ( v8 != nullptr )
            v11 = v8[20 * (__int16)v38 + 14 + 20 * dword_89C2DC * SHIWORD(v38)];
          else
            v11 = -1;
          v12 = (double)((v44 - (__int16)v38) * (v44 - (__int16)v38) + (v46 - SHIWORD(v38)) * (v46 - SHIWORD(v38)));
          sub_4CAC40(v12);
          v13 = v12 + (double)(v40 != v11 ? 0x14 : 0);
          if ( v10 != 0 && v13 > v50 )
          {
            v50 = v13;
            v42 = v34;
          }
          v8 = dword_ABED10;
          ++v10;
        }
        while ( v10 < *(_DWORD *)(a2 + 16) );
        v10 = v34 + 1;
        v6 = v36;
      }
      v34 = v10;
      v7 = *(_DWORD *)(a2 + 16);
      if ( v10 >= v7 - 1 )
        break;
      v4 = a2;
    }
    if ( v42 != -1 )
    {
      v14 = (_DWORD *)(*(_DWORD *)(a2 + 4) + 4 * v42);
      v15 = v6[2];
      if ( v6[4] < v15 )
        goto LABEL_35;
      if ( *((_BYTE *)v6 + 13) != 0 || v15 == 0 )
      {
        v16 = v6[5];
        if ( v16 <= 0 )
          goto LABEL_37;
        if ( (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v6 + 8))(v6, v15 + v16, 0) != 0 )
        {
LABEL_35:
          v17 = v6[4];
          v18 = v6[1];
          v6[4] = v17 + 1;
          *(_DWORD *)(v18 + 4 * v17) = *v14;
        }
        v8 = dword_ABED10;
      }
LABEL_37:
      v4 = a2;
      goto LABEL_38;
    }
    v4 = a2;
  }
  if ( *(_DWORD *)(v4 + 16) == 0 )
  {
LABEL_38:
    v19 = v6[4];
    if ( v19 < v37 )
    {
      while ( 1 )
      {
        v51 = -1.0;
        v41 = -1;
        v35 = 0;
        if ( *(int *)(v4 + 16) > 0 )
        {
          while ( 1 )
          {
            v25 = *(_DWORD *)(*(_DWORD *)(v4 + 4) + 4 * v35);
            if ( v8 != nullptr )
              v43 = v8[20 * (__int16)v25 + 14 + 20 * dword_89C2DC * SHIWORD(v25)];
            else
              v43 = -1;
            v26 = 0;
            v39 = 9999999.0;
            if ( v19 > 0 )
            {
              v48 = (__int16)v25;
              v45 = SHIWORD(v25);
              do
              {
                v47 = *(_DWORD *)(v36[1] + 4 * v26);
                if ( v8 != nullptr )
                  v27 = v8[20 * (__int16)v47 + 14 + 20 * dword_89C2DC * SHIWORD(v47)];
                else
                  v27 = -1;
                v28 = (double)((v48 - (__int16)v47) * (v48 - (__int16)v47) + (v45 - SHIWORD(v47)) * (v45 - SHIWORD(v47)));
                sub_4CAC40(v28);
                v29 = v28 + (double)(v43 != v27 ? 0x14 : 0);
                if ( v29 < v39 )
                  v39 = v29;
                v8 = dword_ABED10;
                ++v26;
                v19 = v36[4];
              }
              while ( v26 < v19 );
            }
            if ( v39 > v51 )
            {
              v51 = v39;
              v41 = v35;
            }
            if ( ++v35 >= *(_DWORD *)(a2 + 16) )
              break;
            v4 = a2;
          }
          v6 = v36;
          v4 = a2;
        }
        v30 = v6[2];
        v49 = (_DWORD *)(*(_DWORD *)(v4 + 4) + 4 * v41);
        if ( v6[4] < v30 )
          goto LABEL_70;
        if ( *((_BYTE *)v6 + 13) != 0 || v30 == 0 )
        {
          v31 = v6[5];
          if ( v31 <= 0 )
            goto LABEL_72;
          if ( (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v6 + 8))(v6, v30 + v31, 0) != 0 )
          {
LABEL_70:
            v32 = v6[4];
            v33 = v6[1];
            v6[4] = v32 + 1;
            *(_DWORD *)(v33 + 4 * v32) = *v49;
          }
          v8 = dword_ABED10;
        }
LABEL_72:
        v19 = v6[4];
        if ( v19 >= v37 )
          return v6;
      }
    }
    return v6;
  }
  v20 = v6[2];
  v21 = *(_DWORD **)(v4 + 4);
  if ( v6[4] < v20
    || (*((_BYTE *)v6 + 13) != 0 || v20 == 0)
    && (v22 = v6[5]) > 0
    && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v6 + 8))(v6, v20 + v22, 0) != 0 )
  {
    v23 = v6[4];
    v24 = v6[1];
    v6[4] = v23 + 1;
    *(_DWORD *)(v24 + 4 * v23) = *v21;
    return v6;
  }
  return v6;
}
