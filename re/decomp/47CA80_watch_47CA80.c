// 0x47ca80 watch_47CA80 size=78A

BOOL __thiscall sub_47CA80(int this)
{
  int v2; // edx
  int v3; // ebp
  unsigned int v4; // edi
  int i; // ebx
  int v6; // eax
  int v7; // eax
  int v8; // eax
  int v9; // edx
  int v10; // ebp
  unsigned int v11; // edi
  int j; // ebx
  int v13; // eax
  int v14; // edx
  int v15; // eax
  int v16; // eax
  int v17; // edx
  int v18; // ebp
  unsigned int v19; // edi
  int k; // ebx
  int v21; // eax
  int v22; // edx
  int v23; // eax
  int v24; // eax
  int v25; // edx
  int v26; // ebp
  unsigned int v27; // edi
  int m; // ebx
  int v29; // eax
  int v30; // edx
  int v31; // eax
  int v32; // eax
  int v33; // edi
  int v34; // eax
  int v35; // eax
  int v36; // ebx
  int v37; // eax
  int v38; // eax
  int v39; // eax
  int v40; // eax
  int v41; // eax
  int v42; // eax
  int v43; // eax
  int v44; // ebx
  int v45; // edi
  int v47; // [esp+10h] [ebp-68h]
  int v48; // [esp+14h] [ebp-64h]
  int v49; // [esp+18h] [ebp-60h]
  int v50; // [esp+1Ch] [ebp-5Ch]
  int v51; // [esp+20h] [ebp-58h]
  int v52; // [esp+24h] [ebp-54h]
  int v53; // [esp+28h] [ebp-50h]
  int v54; // [esp+2Ch] [ebp-4Ch]
  int v55; // [esp+30h] [ebp-48h]
  int v56; // [esp+30h] [ebp-48h]
  int v57; // [esp+30h] [ebp-48h]
  int v58; // [esp+34h] [ebp-44h]
  int v59; // [esp+38h] [ebp-40h]
  int v60; // [esp+38h] [ebp-40h]
  int v61; // [esp+3Ch] [ebp-3Ch]
  int v62; // [esp+40h] [ebp-38h]
  int v63; // [esp+44h] [ebp-34h]
  int v64; // [esp+48h] [ebp-30h]
  int v65; // [esp+4Ch] [ebp-2Ch]
  int v66; // [esp+4Ch] [ebp-2Ch]
  int v67; // [esp+4Ch] [ebp-2Ch]
  int v68; // [esp+4Ch] [ebp-2Ch]
  int v69; // [esp+4Ch] [ebp-2Ch]
  int v70; // [esp+4Ch] [ebp-2Ch]
  int v71; // [esp+4Ch] [ebp-2Ch]
  int v72; // [esp+4Ch] [ebp-2Ch]
  int v73; // [esp+50h] [ebp-28h]
  int v74; // [esp+58h] [ebp-20h] BYREF
  int v75; // [esp+5Ch] [ebp-1Ch]
  int v76; // [esp+60h] [ebp-18h] BYREF
  int v77; // [esp+64h] [ebp-14h]
  int v78; // [esp+68h] [ebp-10h]
  int v79; // [esp+6Ch] [ebp-Ch] BYREF
  int v80; // [esp+70h] [ebp-8h]
  _BYTE v81[4]; // [esp+74h] [ebp-4h] BYREF

  v76 = dword_AA1090;
  v59 = dword_AA1090 + 1;
  if ( dword_AA1090 == -1 )
    v59 = -1;
  v75 = dword_ABAD28;
  v58 = dword_ABAD28 + 41;
  if ( dword_ABAD28 == -1 )
    v58 = -1;
  v55 = dword_AA1134;
  v49 = dword_AA1134 + 15;
  if ( dword_AA1134 == -1 )
    v49 = -1;
  v47 = dword_AA0E24;
  v50 = dword_AA0E24 + 15;
  if ( dword_AA0E24 == -1 )
    v50 = -1;
  v52 = dword_AA0748;
  v51 = dword_AA0748 + 15;
  if ( dword_AA0748 == -1 )
    v51 = -1;
  v54 = dword_AA10A8;
  v53 = dword_AA10A8 + 15;
  if ( dword_AA10A8 == -1 )
    v53 = -1;
  v77 = dword_AA10A4;
  v61 = dword_AA10A4 + 13;
  if ( dword_AA10A4 == -1 )
    v61 = -1;
  v79 = dword_ABBEC8;
  v63 = dword_ABBEC8 + 20;
  if ( dword_ABBEC8 == -1 )
    v63 = -1;
  v78 = dword_AA0E20;
  v62 = dword_AA0E20 + 13;
  if ( dword_AA0E20 == -1 )
    v62 = -1;
  v48 = dword_AA1058;
  v65 = dword_AA1058 + 11;
  if ( dword_AA1058 == -1 )
    v65 = -1;
  v73 = dword_ABC1D8;
  v64 = dword_ABC1D8 + 19;
  if ( dword_ABC1D8 == -1 )
    v64 = -1;
  v2 = dword_ABC2B8;
  v80 = *(_DWORD *)(this + 56);
  if ( v80 == dword_ABC2B8 || v80 >= dword_AA1134 && v80 <= v49 )
  {
    v3 = 0;
    v4 = 0;
    for ( i = 0; i < 4; ++i )
    {
      if ( v4 < 8 )
      {
        v74 = *(_DWORD *)sub_42D510(v81, 4 * (v4 & 7) + 9041544);
        v6 = sub_5657A0(&v74);
        v2 = dword_ABC2B8;
      }
      else
      {
        v6 = this;
      }
      v7 = *(_DWORD *)(v6 + 56);
      if ( v7 != v2 && (v7 < v55 || v7 > v49) )
        v3 |= 1 << i;
      v4 = ((_BYTE)v4 + 2) & 7;
    }
    if ( v3 != 0 )
      *(_DWORD *)(this + 56) = v55 + v3;
    else
      *(_DWORD *)(this + 56) = v2;
  }
  if ( v47 != -1 )
  {
    v8 = *(_DWORD *)(this + 56);
    v9 = dword_ABB104;
    if ( v8 == dword_ABB104 || v8 >= v47 && v8 <= v50 )
    {
      v10 = 0;
      v11 = 0;
      for ( j = 0; j < 4; ++j )
      {
        if ( v11 < 8 )
        {
          v14 = v11 & 7;
          v74 = *(_DWORD *)(this + 36);
          LOWORD(v56) = v74 + LOWORD(dword_89F688[v14]);
          HIWORD(v56) = HIWORD(v74) + HIWORD(dword_89F688[v14]);
          v74 = v56;
          v13 = sub_5657A0(&v74);
          v9 = dword_ABB104;
        }
        else
        {
          v13 = this;
        }
        v15 = *(_DWORD *)(v13 + 56);
        if ( v15 != v9 && (v15 < v47 || v15 > v50) )
          v10 |= 1 << j;
        v11 = ((_BYTE)v11 + 2) & 7;
      }
      if ( v10 != 0 )
        *(_DWORD *)(this + 56) = v47 + v10;
      else
        *(_DWORD *)(this + 56) = v9;
    }
  }
  if ( v52 != -1 )
  {
    v16 = *(_DWORD *)(this + 56);
    v17 = dword_AA0E18;
    if ( v16 == dword_AA0E18 || v16 >= v52 && v16 <= v51 )
    {
      v18 = 0;
      v19 = 0;
      for ( k = 0; k < 4; ++k )
      {
        if ( v19 < 8 )
        {
          v22 = v19 & 7;
          v74 = *(_DWORD *)(this + 36);
          LOWORD(v57) = v74 + LOWORD(dword_89F688[v22]);
          HIWORD(v57) = HIWORD(v74) + HIWORD(dword_89F688[v22]);
          v74 = v57;
          v21 = sub_5657A0(&v74);
          v17 = dword_AA0E18;
        }
        else
        {
          v21 = this;
        }
        v23 = *(_DWORD *)(v21 + 56);
        if ( v23 != v17 && (v23 < v52 || v23 > v51) && (v23 < v75 || v23 > v58) && (v23 < v76 || v23 > v59) )
          v18 |= 1 << k;
        v19 = ((_BYTE)v19 + 2) & 7;
      }
      if ( v18 != 0 )
        *(_DWORD *)(this + 56) = v52 + v18;
      else
        *(_DWORD *)(this + 56) = v17;
    }
  }
  if ( v54 != -1 )
  {
    v24 = *(_DWORD *)(this + 56);
    v25 = dword_ABC2B0;
    if ( v24 == dword_ABC2B0 || v24 >= v54 && v24 <= v53 )
    {
      v26 = 0;
      v27 = 0;
      for ( m = 0; m < 4; ++m )
      {
        if ( v27 < 8 )
        {
          v30 = v27 & 7;
          v76 = *(_DWORD *)(this + 36);
          LOWORD(v60) = v76 + LOWORD(dword_89F688[v30]);
          HIWORD(v60) = HIWORD(v76) + HIWORD(dword_89F688[v30]);
          v76 = v60;
          v29 = sub_5657A0(&v76);
          v25 = dword_ABC2B0;
        }
        else
        {
          v29 = this;
        }
        v31 = *(_DWORD *)(v29 + 56);
        if ( v31 != v25
          && (v31 < v54 || v31 > v53)
          && (v31 < v77 || v31 > v61)
          && (v31 < v78 || v31 > v62)
          && (v31 < v79 || v31 > v63) )
        {
          v26 |= 1 << m;
        }
        v27 = ((_BYTE)v27 + 2) & 7;
      }
      if ( v26 != 0 )
        *(_DWORD *)(this + 56) = v54 + v26;
      else
        *(_DWORD *)(this + 56) = v25;
    }
  }
  v32 = *(_DWORD *)(this + 56);
  if ( v32 >= v73 && v32 <= v64 || v32 >= v48 && v32 <= v65 )
  {
    v33 = 0;
    if ( *(_BYTE *)(this + 284) == 1 )
    {
      v34 = *(_DWORD *)(this + 36);
      LOWORD(v66) = dword_89F6A0 + v34;
      HIWORD(v66) = HIWORD(dword_89F6A0) + HIWORD(v34);
      v79 = v66;
      v33 = *(_BYTE *)(sub_5657A0(&v79) + 284) == 0;
      v35 = *(_DWORD *)(this + 36);
      LOWORD(v66) = dword_89F690 + v35;
      HIWORD(v66) = HIWORD(dword_89F690) + HIWORD(v35);
      v79 = v66;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 2u;
      v36 = v48;
      if ( v33 != 0 )
        *(_DWORD *)(this + 56) = v33 + v48 - 1;
    }
    else
    {
      v36 = v48;
    }
    if ( *(_BYTE *)(this + 284) == 2 )
    {
      v37 = *(_DWORD *)(this + 36);
      LOWORD(v67) = LOWORD(dword_89F688[0]) + v37;
      HIWORD(v67) = HIWORD(dword_89F688[0]) + HIWORD(v37);
      v79 = v67;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 1u;
      v38 = *(_DWORD *)(this + 36);
      LOWORD(v68) = v38 + dword_89F698;
      HIWORD(v68) = HIWORD(v38) + HIWORD(dword_89F698);
      v79 = v68;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 2u;
      if ( v33 != 0 )
        *(_DWORD *)(this + 56) = v33 + v36 + 2;
    }
    if ( *(_BYTE *)(this + 284) == 3 )
    {
      v39 = *(_DWORD *)(this + 36);
      LOWORD(v69) = dword_89F690 + v39;
      HIWORD(v69) = HIWORD(dword_89F690) + HIWORD(v39);
      v79 = v69;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 1u;
      v40 = *(_DWORD *)(this + 36);
      LOWORD(v70) = dword_89F6A0 + v40;
      HIWORD(v70) = HIWORD(dword_89F6A0) + HIWORD(v40);
      v79 = v70;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 2u;
      if ( v33 != 0 )
        *(_DWORD *)(this + 56) = v33 + v36 + 5;
    }
    if ( *(_BYTE *)(this + 284) == 4 )
    {
      v41 = *(_DWORD *)(this + 36);
      LOWORD(v71) = v41 + dword_89F698;
      HIWORD(v71) = HIWORD(v41) + HIWORD(dword_89F698);
      v79 = v71;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 1u;
      v42 = *(_DWORD *)(this + 36);
      LOWORD(v72) = LOWORD(dword_89F688[0]) + v42;
      HIWORD(v72) = HIWORD(dword_89F688[0]) + HIWORD(v42);
      v79 = v72;
      if ( *(_BYTE *)(sub_5657A0(&v79) + 284) == 0 )
        v33 |= 2u;
      if ( v33 == 0 )
        goto LABEL_128;
      *(_DWORD *)(this + 56) = v33 + v36 + 8;
    }
    if ( v33 == 0 )
LABEL_128:
      *(_DWORD *)(this + 56) = *(unsigned __int8 *)(this + 284) + v73 - 1;
  }
  v43 = *(_DWORD *)(this + 56);
  v44 = v80;
  if ( v80 != v43 )
  {
    v45 = *((_DWORD *)dword_A8ED2C + v43);
    if ( (*(int (__thiscall **)(int))(*(_DWORD *)v45 + 156))(v45) == 0 )
      sub_544C80(v45);
  }
  return v44 != *(_DWORD *)(this + 56);
}
