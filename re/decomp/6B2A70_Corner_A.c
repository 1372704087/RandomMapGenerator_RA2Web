// 0x6b2a70 Corner_A size=4B9

int sub_6B2A70()
{
  int v0; // esi
  char *v1; // eax
  _BYTE *v2; // ecx
  int i; // edx
  int result; // eax
  int v5; // ecx
  int v6; // esi
  int v7; // edx
  __int16 v8; // dx
  _WORD *k; // esi
  int v10; // ebp
  __int16 v11; // ax
  int v12; // ecx
  int v13; // edx
  int v14; // esi
  int v15; // ecx
  int v16; // eax
  int v17; // ecx
  int v18; // edi
  _DWORD *v19; // esi
  int v20; // esi
  int v21; // edx
  int v22; // ecx
  _DWORD *v23; // esi
  int v24; // esi
  int v25; // edx
  int v26; // esi
  int *v27; // eax
  int *v28; // eax
  char *v29; // [esp+8h] [ebp-4Ch]
  int v30; // [esp+Ch] [ebp-48h] BYREF
  int v31; // [esp+10h] [ebp-44h] BYREF
  int j; // [esp+14h] [ebp-40h]
  int v33; // [esp+18h] [ebp-3Ch]
  int v34; // [esp+1Ch] [ebp-38h]
  int v35; // [esp+20h] [ebp-34h]
  _WORD v36[2]; // [esp+24h] [ebp-30h] BYREF
  int v37; // [esp+28h] [ebp-2Ch]
  int v38; // [esp+2Ch] [ebp-28h]
  int v39; // [esp+30h] [ebp-24h] BYREF
  int v40; // [esp+34h] [ebp-20h] BYREF
  int v41; // [esp+38h] [ebp-1Ch] BYREF
  char v42[4]; // [esp+3Ch] [ebp-18h] BYREF
  __int16 v43[4]; // [esp+40h] [ebp-14h] BYREF
  _DWORD v44[3]; // [esp+48h] [ebp-Ch] BYREF

  if ( dword_B0B6EC != nullptr )
  {
    operator delete(dword_B0B6EC);
    dword_B0B6EC = nullptr;
  }
  v0 = (dword_87F914 + 1) * (dword_87F918 + 1);
  v1 = (char *)operator new(8 * v0);
  if ( v1 != nullptr )
  {
    if ( v0 - 1 >= 0 )
    {
      v2 = v1 + 5;
      for ( i = v0; i != 0; --i )
      {
        *(_DWORD *)(v2 - 5) = 0;
        *(v2 - 1) = 0;
        *v2 = 0;
        v2 += 8;
      }
    }
    dword_B0B6EC = v1;
  }
  else
  {
    dword_B0B6EC = nullptr;
  }
  dword_8759A8 = dword_87F90C;
  dword_8759AC = dword_87F910;
  v44[0] = -65536;
  result = dword_87F914 + 1;
  v5 = dword_87F918 + 1;
  v44[1] = -1;
  v6 = 0;
  dword_8759A4 = dword_87F914 + 1;
  dword_8759A0 = dword_87F918 + 1;
  v44[2] = 0xFFFF;
  for ( j = 0; v6 < v5; j = v6 )
  {
    v7 = 0;
    v38 = 0;
    if ( result > 0 )
    {
      while ( 1 )
      {
        v37 = 0;
        v31 = 0;
        v29 = (char *)dword_B0B6EC + 8 * v7 + 8 * v6 * result;
        v29[4] = 0;
        v29[5] = 0;
        v43[1] = dword_8759AC + v6;
        v8 = dword_8759A8 + v7;
        v43[0] = v8;
        v30 = *(_DWORD *)v43;
        for ( k = v44; ; k += 2 )
        {
          v10 = SHIWORD(v30) + v8;
          if ( v10 > dword_ABED04
            && v8 - SHIWORD(v30) < dword_ABED04
            && SHIWORD(v30) - v8 < dword_ABED04
            && v10 <= dword_ABED08 )
          {
            break;
          }
          if ( v31 >= 3 )
            break;
          v11 = v43[1] + k[1];
          LOWORD(v33) = v43[0] + *k;
          HIWORD(v33) = v11;
          v8 = v33;
          v30 = v33;
          ++v31;
        }
        v12 = v8;
        v13 = SHIWORD(v30) + v8;
        if ( v13 <= dword_ABED04
          || v12 - SHIWORD(v30) >= dword_ABED04
          || SHIWORD(v30) - v12 >= dword_ABED04
          || v13 > dword_ABED08 )
        {
          v29[4] = 1;
        }
        else
        {
          v14 = *(unsigned __int8 *)(sub_5657A0(&v30) + 284);
          v15 = 15 * *(char *)(sub_5657A0(&v30) + 283) + *(_DWORD *)*(&off_83FF18 + v14);
          v16 = dword_ABED04;
          v37 = v15;
          v17 = (__int16)(v43[1] - 1);
          v18 = v17 + v43[0];
          if ( v18 > dword_ABED04 && v43[0] - v17 < dword_ABED04 && v17 - v43[0] < dword_ABED04 && v18 <= dword_ABED08 )
          {
            v34 = *(_DWORD *)v43 - 0x10000;
            v31 = *(_DWORD *)v43 - 0x10000;
            v19 = (_DWORD *)sub_5657A0(&v31);
            v39 = v19[9];
            if ( (unsigned __int8)sub_5AC230(&v39) == 0
              || v19[17] != -1
              || v19[57] != 0
              || (v40 = v19[9], *(_BYTE *)(sub_58C2A0(&v40) + 69) != 0)
              || (v20 = v19[14]) < dword_A8ED38
              && v20 != 0xFFFF
              && *(_BYTE *)(*((_DWORD *)dword_A8ED2C + v20) + 736) == 0 )
            {
              v29[4] = 1;
            }
            v16 = dword_ABED04;
          }
          v21 = (__int16)(v43[0] - 1);
          v22 = (__int16)(v43[1] - 1);
          if ( v22 + v21 > v16 && v21 - v22 < v16 && v22 - v21 < v16 && v22 + v21 <= dword_ABED08 )
          {
            LOWORD(v35) = v43[0] - 1;
            HIWORD(v35) = v43[1] - 1;
            v40 = v35;
            v23 = (_DWORD *)sub_5657A0(&v40);
            v39 = v23[9];
            if ( (unsigned __int8)sub_5AC230(&v39) == 0
              || v23[17] != -1
              || v23[57] != 0
              || (v31 = v23[9], *(_BYTE *)(sub_58C2A0(&v31) + 69) != 0)
              || (v24 = v23[14]) < dword_A8ED38
              && v24 != 0xFFFF
              && *(_BYTE *)(*((_DWORD *)dword_A8ED2C + v24) + 736) == 0 )
            {
              v29[4] = 1;
            }
            v16 = dword_ABED04;
          }
          v25 = (__int16)(v43[0] - 1);
          v26 = v43[1] + v25;
          if ( v26 > v16 && v25 - v43[1] < v16 && v43[1] - v25 < v16 && v26 <= dword_ABED08 )
          {
            v36[0] = -1;
            v36[1] = 0;
            v41 = *(_DWORD *)sub_42D510(v42, v36);
            v27 = (int *)sub_5657A0(&v41);
            if ( sub_6B2520(v27) == 0 )
              v29[4] = 1;
          }
          if ( (unsigned __int8)sub_5AC230(v43) != 0 )
          {
            v28 = (int *)sub_5657A0(v43);
            if ( sub_6B2520(v28) == 0 )
              v29[4] = 1;
          }
        }
        *(_DWORD *)v29 = v37;
        result = dword_8759A4;
        v7 = ++v38;
        if ( v38 >= dword_8759A4 )
          break;
        v6 = j;
      }
      v5 = dword_8759A0;
      v6 = j;
    }
    ++v6;
  }
  return result;
}
